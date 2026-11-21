import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	INodeExecutionData,
	INodeProperties,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError, sleep } from 'n8n-workflow';

/* The New Black AI — the most used workflows of the studio, as operations of one node. Each operation is one call to
   POST /v1/generate with its workflow's versioned name; the node then waits for the result (GET /v1/generations/{id})
   and returns it, unless « Wait for Result » is off. The fields mirror the public contract:
   https://thenewblack.ai/api/v1/openapi.json */

const BASE_URL = 'https://thenewblack.ai/api/v1';

const WORKFLOW: Record<string, string> = {
	freePromptImage: 'freeform_image-v1',
	productToModel: 'product_to_model-v1',
	virtualTryOn: 'virtual_try_on-v1',
	ghostMannequin: 'image_to_ghost_mannequin-v1',
	freePromptVideo: 'freeform_video-v1',
};
const GENERATE_OPERATIONS = Object.keys(WORKFLOW);
const MODEL_OPERATIONS = ['productToModel', 'virtualTryOn'];

const options = (values: string[]) => values.map((v) => ({ name: v, value: v }));
const RATIOS_IMAGE = ['auto', '9:16', '1:1', '4:5', '3:4', '2:3', '16:9', '4:3', '3:2', '5:4', '21:9'];
const RATIOS_MODEL = ['21:9', '16:9', '3:2', '4:3', '5:4', '1:1', '4:5', '3:4', '2:3', '9:16'];
const RATIOS_GHOST = ['1:1', '9:16', '2:3', '3:4', '3:2', '4:3'];
const RATIOS_VIDEO = ['16:9', '4:3', '1:1', '3:4', '9:16'];
const CAMERA = ['auto', 'eye_level', 'slightly_above', 'slightly_below', 'low_ground'];

const show = (operation: string[]) => ({ show: { operation } });

const properties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'Free Prompt Image',
				value: 'freePromptImage',
				description: 'Create or edit an image from a prompt, with up to 3 reference images',
				action: 'Create an image from a prompt',
			},
			{
				name: 'Free Prompt Video',
				value: 'freePromptVideo',
				description: 'Create a video from a prompt, a start frame or reference images',
				action: 'Create a video from a prompt',
			},
			{
				name: 'Get Generation',
				value: 'getGeneration',
				description: 'Get the status and result of a generation',
				action: 'Get a generation',
			},
			{
				name: 'Ghost Mannequin',
				value: 'ghostMannequin',
				description: 'Turn a product photo into a ghost mannequin visual',
				action: 'Turn a photo into a ghost mannequin visual',
			},
			{
				name: 'Product to Model',
				value: 'productToModel',
				description: 'Turn product photos into an AI model wearing them',
				action: 'Put products on an AI model',
			},
			{
				name: 'Virtual Try-On',
				value: 'virtualTryOn',
				description: 'Put your products on a model photo you supply',
				action: 'Dress a model photo in your products',
			},
		],
		default: 'freePromptImage',
	},

	/* ---- Free Prompt Image ---- */
	{
		displayName: 'Prompt',
		name: 'prompt',
		type: 'string',
		typeOptions: { rows: 3 },
		required: true,
		default: '',
		placeholder: 'e.g. A linen summer dress on a model walking in Positano, golden hour',
		description: 'The request, in words',
		displayOptions: show(['freePromptImage']),
	},
	{
		displayName: 'Reference Image URLs',
		name: 'referenceImages',
		type: 'string',
		default: '',
		placeholder: 'https://…/photo1.jpg, https://…/photo2.jpg',
		description: 'Up to 3 public https URLs of pictures, separated by commas',
		displayOptions: show(['freePromptImage']),
	},

	/* ---- Product to Model / Virtual Try-On ---- */
	{
		displayName: 'Product Image URLs',
		name: 'productImages',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'https://…/product.jpg',
		description: 'Up to 3 public https URLs of product photos, separated by commas',
		displayOptions: show(MODEL_OPERATIONS),
	},
	{
		displayName: 'Model Image URL',
		name: 'modelImage',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'https://…/model.jpg',
		description: 'A public https URL of the model photo to dress',
		displayOptions: show(['virtualTryOn']),
	},
	{
		displayName: 'Gender',
		name: 'gender',
		type: 'options',
		options: options(['Woman', 'Man', 'Girl', 'Boy']),
		default: 'Woman',
		description: 'Who wears the products',
		displayOptions: show(['productToModel']),
	},
	{
		displayName: 'Body Shape',
		name: 'bodyShape',
		type: 'options',
		options: options(['Small size', 'Mid size', 'Plus size', 'Pregnant']),
		default: 'Mid size',
		description: "The model's build",
		displayOptions: show(['productToModel']),
	},
	{
		displayName: 'Age',
		name: 'age',
		type: 'options',
		options: options(['3', '5', '7', '10', '13', '16', '20', '25', '30', '35', '40', '45', '50', '55', '60']),
		default: '25',
		description: "The model's age",
		displayOptions: show(['productToModel']),
	},
	{
		displayName: 'Origin',
		name: 'origin',
		type: 'string',
		default: 'Italy',
		description: 'The model\'s origin, a country name, e.g. "Italy"',
		displayOptions: show(['productToModel']),
	},

	/* ---- Ghost Mannequin ---- */
	{
		displayName: 'Image URL',
		name: 'garmentImage',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'https://…/garment.jpg',
		description: 'A public https URL of the product photo',
		displayOptions: show(['ghostMannequin']),
	},
	{
		displayName: 'Product to Recreate',
		name: 'garmentToRecreate',
		type: 'string',
		default: '',
		placeholder: 'e.g. the denim jacket',
		description: 'Which product in the photo to recreate',
		displayOptions: show(['ghostMannequin']),
	},

	/* ---- Free Prompt Video ---- */
	{
		displayName: 'Prompt',
		name: 'videoPrompt',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		placeholder: 'e.g. The model walks toward the camera, slight breeze in the fabric',
		description: 'The request, in words',
		displayOptions: show(['freePromptVideo']),
	},
	{
		displayName: 'Start Image URL',
		name: 'startImage',
		type: 'string',
		default: '',
		placeholder: 'https://…/first-frame.jpg',
		description: 'A public https URL of the picture the video starts from',
		displayOptions: show(['freePromptVideo']),
	},
	{
		displayName: 'Duration (Seconds)',
		name: 'duration',
		type: 'options',
		options: options(['5', '10', '15']),
		default: '5',
		description: 'The clip length',
		displayOptions: show(['freePromptVideo']),
	},

	/* ---- Format, per workflow ---- */
	{
		displayName: 'Ratio',
		name: 'ratio',
		type: 'options',
		options: options(RATIOS_IMAGE),
		default: 'auto',
		description: 'The output format',
		displayOptions: show(['freePromptImage']),
	},
	{
		displayName: 'Ratio',
		name: 'ratio',
		type: 'options',
		options: options(['auto', ...RATIOS_MODEL]),
		default: 'auto',
		description: 'The output format',
		displayOptions: show(['virtualTryOn']),
	},
	{
		displayName: 'Ratio',
		name: 'ratio',
		type: 'options',
		options: options(RATIOS_MODEL),
		default: '3:4',
		description: 'The output format',
		displayOptions: show(['productToModel']),
	},
	{
		displayName: 'Ratio',
		name: 'ratio',
		type: 'options',
		options: options(RATIOS_GHOST),
		default: '1:1',
		description: 'The output format',
		displayOptions: show(['ghostMannequin']),
	},
	{
		displayName: 'Ratio',
		name: 'ratio',
		type: 'options',
		options: options(RATIOS_VIDEO),
		default: '9:16',
		description: 'The output format',
		displayOptions: show(['freePromptVideo']),
	},
	{
		displayName: 'Quality Tier',
		name: 'tier',
		type: 'options',
		options: [
			{ name: 'Standard', value: 'standard', description: 'Fast; 1K image or 720p video' },
			{ name: 'Pro', value: 'pro', description: 'Thinks before generating; 2K image or 1080p video' },
			{ name: 'Ultra', value: 'ultra', description: 'Deep thinking; 4K image or 1080p video on the top video model' },
		],
		default: 'standard',
		description: 'The quality tier; each costs a different number of credits',
		displayOptions: show(GENERATE_OPERATIONS),
	},

	/* ---- Optional fields ---- */
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show(MODEL_OPERATIONS),
		options: [
			{
				displayName: 'Camera Angle',
				name: 'seg_camera',
				type: 'options',
				options: options(CAMERA),
				default: 'auto',
				description: 'Where the camera stands',
			},
			{
				displayName: 'Framing',
				name: 'seg_framing',
				type: 'string',
				default: '',
				placeholder: 'e.g. full body',
				description: 'How the shot is framed, in a few words',
			},
			{
				displayName: 'Physical Features & Pose',
				name: 'seg_features',
				type: 'string',
				default: '',
				placeholder: 'e.g. Chin up. Back view.',
				description: 'Short sentences about the person and the pose',
			},
			{
				displayName: 'Scene Description',
				name: 'seg_scene',
				type: 'string',
				default: '',
				placeholder: 'e.g. a rooftop terrace at dusk',
				description: 'The scene around the person, in words',
			},
			{
				displayName: 'Scene Image URL',
				name: 'scene_image',
				type: 'string',
				default: '',
				description: 'A public https URL of a picture of the scene',
			},
			{
				displayName: 'Styling Details',
				name: 'seg_look',
				type: 'string',
				default: '',
				placeholder: 'e.g. a beige trench coat, gold hoops',
				description: 'What else is worn with your products',
			},
		],
	},
	{
		displayName: 'Additional Fields',
		name: 'videoFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show(['freePromptVideo']),
		options: [
			{
				displayName: 'Audio',
				name: 'audio',
				type: 'string',
				default: '',
				placeholder: 'No music, natural environment sounds.',
				description: 'The sound of the clip: music, voices, ambience',
			},
			{
				displayName: 'End Image URL',
				name: 'end_image',
				type: 'string',
				default: '',
				description: 'A public https URL of an optional closing frame',
			},
			{
				displayName: 'Reference Image URLs',
				name: 'references',
				type: 'string',
				default: '',
				description:
					'One to three public https URLs, separated by commas, of pictures to put INTO the clip (named in the prompt as Image 1, Image 2, Image 3). Replaces the start and end frames.',
			},
			{
				displayName: 'Sound',
				name: 'sound',
				type: 'options',
				options: [
					{ name: 'On', value: 'on' },
					{ name: 'Off (Silent Clip)', value: 'off' },
				],
				default: 'on',
				description: "Whether the clip has its own sound (voices, ambience)",
			},
			{
				displayName: 'Speed',
				name: 'speed',
				type: 'options',
				options: options(['Real speed', 'Slow motion']),
				default: 'Real speed',
				description: 'The pace of the clip',
			},
		],
	},

	/* ---- Get Generation ---- */
	{
		displayName: 'Generation ID',
		name: 'generationId',
		type: 'string',
		required: true,
		default: '',
		description: 'The generation_id returned when the generation was started',
		displayOptions: show(['getGeneration']),
	},

	/* ---- Waiting ---- */
	{
		displayName: 'Wait for Result',
		name: 'waitForResult',
		type: 'boolean',
		default: true,
		description:
			'Whether to wait until the generation is finished and return its result. Off: return at once with the generation_id, to read later with Get Generation.',
		displayOptions: show(GENERATE_OPERATIONS),
	},
	{
		displayName: 'Timeout (Minutes)',
		name: 'timeoutMinutes',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 30 },
		default: 10,
		description: 'How long to wait for the result before stopping with an error. Videos usually take a few minutes.',
		displayOptions: { show: { operation: GENERATE_OPERATIONS, waitForResult: [true] } },
	},
];

const urls = (value: unknown): string[] =>
	String(value ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);

const compact = (o: IDataObject): IDataObject =>
	Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== undefined && v !== null && !(Array.isArray(v) && !v.length)));

export class TheNewBlack implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'The New Black AI',
		name: 'theNewBlack',
		icon: { light: 'file:thenewblack.svg', dark: 'file:thenewblack.dark.svg' },
		group: ['transform'],
		version: [1],
		subtitle: '={{$parameter["operation"]}}',
		description: 'Generate fashion images and videos with The New Black AI: on-model photos, virtual try-on, ghost mannequin, free prompt image and video',
		defaults: { name: 'The New Black AI' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'theNewBlackApi', required: true }],
		properties,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];

		const call = async (method: IHttpRequestMethods, url: string, body?: IDataObject): Promise<IDataObject> => {
			try {
				return (await this.helpers.httpRequestWithAuthentication.call(this, 'theNewBlackApi', {
					method,
					url: `${BASE_URL}${url}`,
					body,
					json: true,
				})) as IDataObject;
			} catch (error) {
				throw new NodeApiError(this.getNode(), error as never);
			}
		};

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;

				if (operation === 'getGeneration') {
					const id = (this.getNodeParameter('generationId', i) as string).trim();
					out.push({ json: await call('GET', `/generations/${encodeURIComponent(id)}`), pairedItem: i });
					continue;
				}

				const workflow = WORKFLOW[operation];
				if (!workflow) throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`, { itemIndex: i });

				const body: IDataObject = {
					workflow,
					tier: this.getNodeParameter('tier', i) as string,
					ratio: this.getNodeParameter('ratio', i) as string,
				};

				if (operation === 'freePromptImage') {
					body.prompt = this.getNodeParameter('prompt', i) as string;
					body.reference_images = urls(this.getNodeParameter('referenceImages', i, ''));
				} else if (MODEL_OPERATIONS.includes(operation)) {
					body.product_images = urls(this.getNodeParameter('productImages', i));
					const extra = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
					const { scene_image: sceneImage, ...segments } = extra;
					body.scene_image = sceneImage;
					const fields: IDataObject = { ...segments };
					if (operation === 'virtualTryOn') {
						body.model_image = this.getNodeParameter('modelImage', i) as string;
					} else {
						fields.gender = this.getNodeParameter('gender', i) as string;
						fields.body_shape = this.getNodeParameter('bodyShape', i) as string;
						fields.age = this.getNodeParameter('age', i) as string;
						fields.origin = this.getNodeParameter('origin', i) as string;
					}
					body.fields = compact(fields);
				} else if (operation === 'ghostMannequin') {
					body.garment_image = this.getNodeParameter('garmentImage', i) as string;
					body.fields = compact({ garmenttorecreate: this.getNodeParameter('garmentToRecreate', i, '') as string });
				} else if (operation === 'freePromptVideo') {
					body.prompt = this.getNodeParameter('videoPrompt', i, '') as string;
					body.start_image = this.getNodeParameter('startImage', i, '') as string;
					body.duration = this.getNodeParameter('duration', i) as string;
					const v = this.getNodeParameter('videoFields', i, {}) as IDataObject;
					body.sound = v.sound;
					body.end_image = v.end_image;
					body.references = urls(v.references);
					body.fields = compact({ audio: v.audio, speed: v.speed });
				}

				const started = await call('POST', '/generate', compact(body));
				const id = started.generation_id as string;

				if (!(this.getNodeParameter('waitForResult', i) as boolean) || !id) {
					out.push({ json: started, pairedItem: i });
					continue;
				}

				/* Wait for the result: a poll every 5 seconds until it settles or the timeout passes. */
				const deadline = Date.now() + (this.getNodeParameter('timeoutMinutes', i) as number) * 60_000;
				let generation: IDataObject = started;
				while (true) {
					await sleep(5000);
					generation = await call('GET', `/generations/${encodeURIComponent(id)}`);
					const status = generation.status as string;
					if (status === 'succeeded') break;
					if (status === 'failed' || status === 'canceled') {
						const err = (generation.error as IDataObject | undefined) ?? {};
						throw new NodeOperationError(this.getNode(), `The generation ${status}: ${err.message ?? 'no reason given'}`, {
							itemIndex: i,
							description: `generation_id ${id}${err.code ? ` · ${err.code}` : ''}`,
						});
					}
					if (Date.now() > deadline) {
						throw new NodeOperationError(this.getNode(), 'The generation is still running after the timeout', {
							itemIndex: i,
							description: `It goes on: read it later with Get Generation, generation_id ${id}`,
						});
					}
				}
				out.push({ json: generation, pairedItem: i });
			} catch (error) {
				if (this.continueOnFail()) {
					out.push({ json: { error: (error as Error).message }, pairedItem: i });
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [out];
	}
}
