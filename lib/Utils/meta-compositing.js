/**
 * Lia@Changes [WIP]
 * Meta Compositing — send rich messages (code, table, text, etc.) with a
 * Meta AI-style progress indicator that appears BEFORE the final message.
 *
 * The progress placeholder is sent first (with BotProgressIndicatorMetadata),
 * then deleted, then the final rich message is sent fresh — so NO "edited"
 * badge ever appears. Identical to how Meta AI itself works.
 *
 * metaTyping() — shows the "typing..." / planning steps indicator only.
 * sendMetaComposited() — full flow: typing → delete → final message.
 *
 * If you use or copy this code, please credit @crysnovax/bailey.
 */

import { proto } from '../../WAProto/index.js';
import { prepareRichResponseMessage, wrapToBotForwardedMessage, botMetadataSignature, botMetadataCertificate } from './rich-message-utils.js';
import { BOT_RENDERING_CONFIG_METADATA } from '../Defaults/index.js';
import { generateWAMessageFromContent } from './messages.js';
import { unixTimestampSeconds, delay } from './generics.js';

// ─── Step status enum mirrors proto.BotProgressIndicatorMetadata.BotPlanningStepMetadata status field ───
export const PlanningStepStatus = {
    IN_PROGRESS: 0,
    DONE: 1,
    FAILED: 2
};

/**
 * Build a BotProgressIndicatorMetadata object.
 * @param {string} description   - Top-level label shown while "thinking"
 * @param {Array}  steps         - Array of { title, body?, status?, isReasoning? }
 * @param {number} estimatedMs   - Optional estimated completion time in ms
 */
export const buildProgressIndicator = (description, steps = [], estimatedMs) => {
    const stepsMetadata = steps.map(step => {
        const s = {
            statusTitle: step.title,
            status: step.status ?? PlanningStepStatus.IN_PROGRESS
        };
        if (step.body) s.statusBody = step.body;
        if (step.isReasoning) s.isReasoning = true;
        if (step.isEnhancedSearch) s.isEnhancedSearch = true;
        return s;
    });

    const indicator = { stepsMetadata };
    if (description) indicator.progressDescription = description;
    if (estimatedMs != null) indicator.estimatedCompletionTime = estimatedMs;
    return indicator;
};

/**
 * Build the compositing placeholder message — the one that shows the
 * "Meta AI is thinking..." / planning steps indicator in the chat bubble.
 *
 * This is a botForwardedMessage with richResponseMessage = null content
 * but with progressIndicatorMetadata on the botMetadata.
 *
 * @param {object} options
 * @param {string} options.description        - "Thinking…" label
 * @param {Array}  options.steps              - Planning steps array
 * @param {number} [options.estimatedMs]      - Estimated completion ms
 * @param {string} [options.placeholderText]  - Text shown in the bubble body while loading
 */
export const buildCompositingPlaceholder = ({
    description = 'Thinking…',
    steps = [],
    estimatedMs,
    placeholderText = ''
}) => {
    const progressIndicatorMetadata = buildProgressIndicator(description, steps, estimatedMs);

    // Minimal richResponseMessage so the bubble renders in Bot mode
    const textEncoder = new TextEncoder();
    const unifiedData = textEncoder.encode(JSON.stringify({
        response_id: crypto.randomUUID(),
        sections: placeholderText ? [{
            view_model: {
                primitive: {
                    text: placeholderText,
                    inline_entities: [],
                    __typename: 'GenAIMarkdownTextUXPrimitive'
                },
                __typename: 'GenAISingleLayoutViewModel'
            }
        }] : []
    }));

    const richResponseMessage = {
        messageType: proto.AIRichResponseMessageType.AI_RICH_RESPONSE_TYPE_STANDARD,
        unifiedResponse: { data: unifiedData },
        submessages: []
    };

    return {
        messageContextInfo: {
            botMetadata: {
                pluginMetadata: {},
                progressIndicatorMetadata,
                verificationMetadata: {
                    proofs: [{
                        certificateChain: [
                            botMetadataCertificate(684),
                            botMetadataCertificate(892)
                        ],
                        version: 1,
                        useCase: 1,
                        signature: botMetadataSignature()
                    }]
                },
                botRenderingConfigMetadata: BOT_RENDERING_CONFIG_METADATA
            }
        },
        botForwardedMessage: {
            message: { richResponseMessage }
        }
    };
};

/**
 * metaTyping — sends ONLY the progress/compositing indicator to a JID.
 * Does NOT delete or send a follow-up — caller controls that.
 *
 * Returns the sent message key so you can delete it later.
 *
 * @param {object} sock       - Baileys socket
 * @param {string} jid        - Destination JID
 * @param {object} options    - Same options as buildCompositingPlaceholder
 * @returns {Promise<object>} - The sent WAMessage
 */
export const metaTyping = async (sock, jid, {
    description = 'Thinking…',
    steps = [],
    estimatedMs,
    placeholderText = ''
} = {}) => {
    const placeholder = buildCompositingPlaceholder({
        description,
        steps,
        estimatedMs,
        placeholderText
    });

    return sock.sendMessage(jid, { raw: true, ...placeholder });
};

/**
 * sendMetaComposited — full Meta AI flow:
 *   1. Send progress indicator placeholder
 *   2. Wait `thinkingMs` (default 2000ms)
 *   3. Delete the placeholder (no "edited" badge ever appears)
 *   4. Send the final rich message fresh
 *
 * Supports all existing richResponse content types: text, code, table,
 * expressions (LaTeX), items (reels carousel), or the richResponse array.
 *
 * @param {object} sock            - Baileys socket
 * @param {string} jid             - Destination JID
 * @param {object} content         - Same content object as sendMessage richResponse
 * @param {object} [options]
 * @param {number} [options.thinkingMs=2000]          - How long placeholder shows
 * @param {string} [options.description='Thinking…']  - Placeholder label
 * @param {Array}  [options.steps=[]]                 - Planning steps to show
 * @param {string} [options.placeholderText='']       - Body text while loading
 * @param {object} [options.sendOptions={}]           - Extra options for final sendMessage
 * @returns {Promise<object>} - The final sent WAMessage
 */
export const sendMetaComposited = async (sock, jid, content, {
    thinkingMs = 2000,
    description = 'Thinking…',
    steps = [],
    placeholderText = '',
    sendOptions = {}
} = {}) => {
    // 1. Send the compositing placeholder
    const placeholder = await metaTyping(sock, jid, {
        description,
        steps,
        placeholderText
    });

    try {
        // 2. Wait — this is the "thinking" window
        await delay(thinkingMs);

        // 3. Delete the placeholder silently
        if (placeholder?.key) {
            await sock.sendMessage(jid, { delete: placeholder.key });
        }
    } catch (_) {
        // Non-fatal — always attempt final send
    }

    // 4. Send the final rich message as a brand-new message (no edit = no badge)
    return sock.sendMessage(jid, content, sendOptions);
};

/**
 * Convenience: build a steps array from plain strings with IN_PROGRESS status.
 * Use PlanningStepStatus.DONE to mark a step complete.
 *
 * @example
 * buildSteps(['Searching…', 'Reading sources…', 'Writing response…'])
 */
export const buildSteps = (titles, status = PlanningStepStatus.IN_PROGRESS) =>
    titles.map(title => ({ title, status }));

