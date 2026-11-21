# n8n-nodes-thenewblack

This is an n8n community node. It lets you use [The New Black AI](https://thenewblack.ai) in your n8n workflows.

The New Black AI is the AI platform for fashion brands: on-model photos from product shots, virtual try-on, ghost mannequin visuals, and fashion images and videos from a prompt.

[n8n](https://n8n.io/) is a fair-code licensed workflow automation platform.

[Installation](#installation) · [Operations](#operations) · [Credentials](#credentials) · [Usage](#usage) · [Resources](#resources) · [Version history](#version-history)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation. The package name is `n8n-nodes-thenewblack`.

## Operations

| Operation | What it does |
|---|---|
| **Free Prompt Image** | Create or edit an image from a prompt, with up to 3 reference images |
| **Product to Model** | Turn product photos into an AI model wearing them (gender, body shape, age, origin, framing, scene…) |
| **Virtual Try-On** | Put your products on a model photo you supply |
| **Ghost Mannequin** | Turn a product photo into a ghost mannequin visual |
| **Free Prompt Video** | Create a video from a prompt, a start frame or reference images (5, 10 or 15 seconds) |
| **Get Generation** | Read the status and result of a generation |

Every generating operation waits for the result by default and returns it: `status`, and `result.url` for the image or video. Turn off **Wait for Result** to get the `generation_id` at once and read it later with **Get Generation**.

Images are passed as public `https` URLs. Each operation has a **Quality Tier** (Standard, Pro, Ultra); each tier costs a different number of credits, shown in the [API documentation](https://thenewblack.ai/clothing_fashion_api_integrations).

## Credentials

1. Create a The New Black AI account at [thenewblack.ai](https://thenewblack.ai).
2. Signed in, open **Profile › API** and create an API key. It starts with `tnb_live_`.
3. In n8n, add a **The New Black AI API** credential and paste the key. The credential is tested against your account.

Generations use your account's credits.

## Usage

A typical flow: a new product in your store → **Product to Model** with the product photo URL → the image URL goes back to your product page, a folder or a message.

Result URLs are kept for 48 hours: copy the file somewhere of your own if you need it longer.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [The New Black AI API documentation](https://thenewblack.ai/clothing_fashion_api_integrations)
- [OpenAPI specification](https://thenewblack.ai/api/v1/openapi.json)

## Version history

- **0.1.1** — Published from GitHub Actions with provenance.
- **0.1.0** — Free Prompt Image, Product to Model, Virtual Try-On, Ghost Mannequin, Free Prompt Video, Get Generation.
