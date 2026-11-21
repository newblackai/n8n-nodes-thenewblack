import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class TheNewBlackApi implements ICredentialType {
	name = 'theNewBlackApi';

	displayName = 'The New Black AI API';

	icon: Icon = { light: 'file:thenewblack.svg', dark: 'file:thenewblack.dark.svg' };

	documentationUrl = 'https://thenewblack.ai/clothing_fashion_api_integrations';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			placeholder: 'tnb_live_…',
			description:
				'An API key of your The New Black AI account, created in Profile › API (https://thenewblack.ai/profile?tab=api)',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://thenewblack.ai/api/v1',
			url: '/account',
			method: 'GET',
		},
	};
}
