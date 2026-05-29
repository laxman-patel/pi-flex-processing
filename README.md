# pi-flex-processing

A tiny [pi](https://pi.dev) extension that lets you switch OpenAI API requests between normal processing and [Flex processing](https://developers.openai.com/api/docs/guides/flex-processing) from the chat UI.

Flex processing lowers cost for supported OpenAI models in exchange for slower responses and occasional resource unavailability.

## Install

```bash
pi install npm:pi-flex-processing
```

## Usage

Inside pi:

```text
/flex
```

Opens a simple selector for normal vs flex processing.

Direct commands:

```text
/flex on       # enable OpenAI flex processing where supported
/flex off      # use normal OpenAI processing
/flex toggle   # switch between modes
/flex status   # show current mode
```

Alias:

```text
/openai-flex
```

## Supported OpenAI Flex models

As of 2026-05-29, OpenAI's Flex pricing table lists:

- `gpt-5.5`
- `gpt-5.5-pro`
- `gpt-5.4`
- `gpt-5.4-mini`
- `gpt-5.4-nano`
- `gpt-5.4-pro`

When flex mode is enabled on an unsupported OpenAI model, the extension warns once and sends normal processing instead (`service_tier: "default"`). The footer shows `openai:flex n/a`.

## Behavior

- Applies only to pi's `openai` provider, i.e. the provider that uses `OPENAI_API_KEY`.
- Supported model + flex mode: sends `service_tier: "flex"`.
- Unsupported model + flex mode: warns and sends `service_tier: "default"`.
- Normal mode: sends `service_tier: "default"`.
- The selected mode is persisted in the current pi session.

## Publishing

This repo publishes to npm through GitHub Actions and npm Trusted Publishing when a version tag is pushed.

One-time setup: configure npm Trusted Publishing for this package with GitHub Actions, repository `laxman-patel/pi-flex-processing`, workflow filename `publish.yml`, and no environment name.

Release flow:

```bash
npm version patch
npm pack --dry-run
git push --follow-tags
```

The pushed `vX.Y.Z` tag triggers `.github/workflows/publish.yml`, verifies the tag matches `package.json`, and runs `npm publish --access public` via OIDC trusted publishing.

## Package metadata

This repo is structured as a pi package:

```json
{
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions/openai-flex.ts"]
  }
}
```

That makes it discoverable by the pi package gallery at <https://pi.dev/packages> once published/listed.

## Security note

Pi extensions run with your full system permissions. Review any extension before installing it.
