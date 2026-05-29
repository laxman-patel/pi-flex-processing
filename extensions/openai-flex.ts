/**
 * OpenAI Flex Processing extension.
 *
 * Usage in pi:
 *   /flex            choose normal vs flex from the chat UI
 *   /flex on         force OpenAI service_tier="flex"
 *   /flex off        force OpenAI service_tier="default" (normal)
 *   /flex status     show the current mode
 *
 * Only applies when the active provider is `openai` (the OPENAI_API_KEY provider).
 */
import type {
	ExtensionAPI,
	ExtensionCommandContext,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";

type ProcessingTier = "normal" | "flex";

const STATE_ENTRY = "openai-flex-processing";
const STATUS_KEY = "openai-processing";
const SUPPORTED_FLEX_MODELS = new Set([
	"gpt-5.5",
	"gpt-5.5-pro",
	"gpt-5.4",
	"gpt-5.4-mini",
	"gpt-5.4-nano",
	"gpt-5.4-pro",
]);

let tier: ProcessingTier = "normal";
const warnedUnsupportedModels = new Set<string>();

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isOpenAIProvider(ctx: ExtensionContext): boolean {
	return ctx.model?.provider === "openai";
}

function restoreTierFromSession(ctx: ExtensionContext) {
	tier = "normal";

	for (const entry of ctx.sessionManager.getBranch()) {
		if (entry.type !== "custom" || entry.customType !== STATE_ENTRY) continue;

		const savedTier = (entry as { data?: { tier?: unknown } }).data?.tier;
		if (savedTier === "normal" || savedTier === "flex") {
			tier = savedTier;
		}
	}
}

function supportsFlex(ctx: ExtensionContext): boolean {
	return !!ctx.model && isOpenAIProvider(ctx) && SUPPORTED_FLEX_MODELS.has(ctx.model.id);
}

function getSupportedModelsText(): string {
	return Array.from(SUPPORTED_FLEX_MODELS).join(", ");
}

function warnIfFlexUnsupported(ctx: ExtensionContext) {
	if (!ctx.hasUI || tier !== "flex" || !isOpenAIProvider(ctx) || supportsFlex(ctx)) return;

	const modelId = ctx.model?.id ?? "unknown";
	if (warnedUnsupportedModels.has(modelId)) return;

	warnedUnsupportedModels.add(modelId);
	ctx.ui.notify(`OpenAI flex is not supported for ${modelId}; using normal processing. Supported: ${getSupportedModelsText()}`, "warning");
}

function updateStatus(ctx: ExtensionContext) {
	if (!ctx.hasUI || !isOpenAIProvider(ctx)) {
		ctx.ui.setStatus(STATUS_KEY, undefined);
		return;
	}

	const label =
		tier === "flex"
			? supportsFlex(ctx)
				? ctx.ui.theme.fg("warning", "openai:flex")
				: ctx.ui.theme.fg("warning", "openai:flex n/a")
			: ctx.ui.theme.fg("muted", "openai:normal");
	ctx.ui.setStatus(STATUS_KEY, label);
}

function parseTier(args: string | undefined): ProcessingTier | "toggle" | "status" | undefined {
	const value = (args ?? "").trim().toLowerCase();
	if (!value) return undefined;

	if (["on", "flex", "enable", "enabled"].includes(value)) return "flex";
	if (["off", "normal", "default", "standard", "disable", "disabled"].includes(value)) return "normal";
	if (["toggle", "switch"].includes(value)) return "toggle";
	if (["status", "show"].includes(value)) return "status";

	return undefined;
}

async function chooseTier(ctx: ExtensionCommandContext): Promise<ProcessingTier | undefined> {
	if (!ctx.hasUI) return undefined;

	const normalOption = `normal / standard${tier === "normal" ? " ✓" : ""}`;
	const flexOption = `flex / lower cost, slower${tier === "flex" ? " ✓" : ""}`;
	const choice = await ctx.ui.select("OpenAI processing tier", [normalOption, flexOption]);

	if (!choice) return undefined;
	return choice.startsWith("flex") ? "flex" : "normal";
}

async function setTier(pi: ExtensionAPI, nextTier: ProcessingTier, ctx: ExtensionCommandContext) {
	tier = nextTier;
	pi.appendEntry(STATE_ENTRY, { tier });
	updateStatus(ctx);

	const target = tier === "flex" ? "flex processing" : "normal processing";
	const suffix = isOpenAIProvider(ctx) ? "" : " (will apply when the active provider is openai)";
	ctx.ui.notify(`OpenAI ${target} enabled${suffix}`, "info");
	warnIfFlexUnsupported(ctx);
}

async function handleCommand(pi: ExtensionAPI, args: string | undefined, ctx: ExtensionCommandContext) {
	const parsed = parseTier(args);

	if (parsed === "status") {
		const suffix = isOpenAIProvider(ctx) ? "" : " (active model is not provider=openai)";
		ctx.ui.notify(`OpenAI processing tier: ${tier}${suffix}`, "info");
		updateStatus(ctx);
		return;
	}

	if (parsed === "toggle") {
		await setTier(pi, tier === "flex" ? "normal" : "flex", ctx);
		return;
	}

	if (parsed === "normal" || parsed === "flex") {
		await setTier(pi, parsed, ctx);
		return;
	}

	if ((args ?? "").trim()) {
		ctx.ui.notify("Usage: /flex, /flex on, /flex off, /flex toggle, or /flex status", "warning");
		return;
	}

	const selectedTier = await chooseTier(ctx);
	if (!selectedTier) {
		ctx.ui.notify(`OpenAI processing tier: ${tier}`, "info");
		return;
	}

	await setTier(pi, selectedTier, ctx);
}

export default function openAIFlexExtension(pi: ExtensionAPI) {
	pi.registerCommand("flex", {
		description: "Switch OpenAI processing between normal and flex",
		handler: (args, ctx) => handleCommand(pi, args, ctx),
	});

	pi.registerCommand("openai-flex", {
		description: "Switch OpenAI processing between normal and flex",
		handler: (args, ctx) => handleCommand(pi, args, ctx),
	});

	pi.on("session_start", (_event, ctx) => {
		restoreTierFromSession(ctx);
		updateStatus(ctx);
	});

	pi.on("session_tree", (_event, ctx) => {
		restoreTierFromSession(ctx);
		updateStatus(ctx);
	});

	pi.on("model_select", (_event, ctx) => {
		updateStatus(ctx);
		warnIfFlexUnsupported(ctx);
	});

	pi.on("before_provider_request", (event, ctx) => {
		if (!isOpenAIProvider(ctx) || !isRecord(event.payload)) return;

		warnIfFlexUnsupported(ctx);

		return {
			...event.payload,
			service_tier: tier === "flex" && supportsFlex(ctx) ? "flex" : "default",
		};
	});
}
