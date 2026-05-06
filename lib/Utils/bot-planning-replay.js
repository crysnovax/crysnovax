/**
 * Lia@Changes [WIP]
 * botPlanningReplay — Meta AI-style live reasoning feed.
 *
 * Sends a progress indicator with all steps IN_PROGRESS, then replays
 * each step completing in real time via sequential edits — exactly how
 * Meta AI's "Thinking…" bubble works. Final rich message lands clean
 * with NO "edited" badge, using the same delete-resend flow from
 * meta-compositing.
 *
 *   replayPlanning(sock, jid, steps, finalContent, options)
 *
 * Flow:
 *   Send placeholder (all steps IN_PROGRESS)
 *     → edit: step[0] → DONE  (stepDelayMs)
 *     → edit: step[1] → DONE  (stepDelayMs)
 *     → ...
 *     → edit: step[n] → DONE  (finalPauseMs)
 *     → delete placeholder
 *     → send final rich message fresh
 *
 * If you use or copy this code, please credit @crysnovax/bailey.
 */

import { proto } from '../../WAProto/index.js';
import {
    buildCompositingPlaceholder,
    buildProgressIndicator,
    PlanningStepStatus
} from './meta-compositing.js';
import { botMetadataSignature, botMetadataCertificate } from './rich-message-utils.js';
import { BOT_RENDERING_CONFIG_METADATA } from '../Defaults/index.js';
import { delay } from './generics.js';

// ─── Internal: rebuild the full botForwardedMessage with updated step statuses ───────────────
const buildReplayFrame = (description, steps, placeholderText = '') => {
    return buildCompositingPlaceholder({ description, steps, placeholderText });
};

// ─── Internal: send an in-place edit of the planning bubble with new step states ─────────────
const editPlanningBubble = async (sock, jid, key, description, steps, placeholderText) => {
    const updated = buildReplayFrame(description, steps, placeholderText);
    // Use { edit: key, raw: true } — routes through protocolMessage.editedMessage
    await sock.sendMessage(jid, {
        raw: true,
        edit: key,
        ...updated
    });
};

/**
 * replayPlanning — full live planning animation.
 *
 * @param {object}   sock                        - Baileys socket
 * @param {string}   jid                         - Destination JID
 * @param {Array}    steps                        - Array of step definitions:
 *                                                  { title, body?, isReasoning?, isEnhancedSearch? }
 *                                                  Status is managed automatically — do NOT pass status here.
 * @param {object}   finalContent                 - Rich content for the final message.
 *                                                  Same as sendMessage: { code, table, text, richResponse… }
 * @param {object}   [options]
 * @param {string}   [options.description]        - Top label while thinking. Default: 'Thinking…'
 * @param {string}   [options.placeholderText]    - Body text shown in bubble while loading.
 * @param {number}   [options.stepDelayMs]        - Ms between each step completing. Default: 900
 * @param {number}   [options.finalPauseMs]       - Ms to hold after all steps done before cleanup. Default: 600
 * @param {boolean}  [options.abortOnDisconnect]  - Stop replay loop if socket closes. Default: true
 * @param {object}   [options.sendOptions]        - Extra options for final sendMessage call.
 * @returns {Promise<object>} - The final sent WAMessage
 */
export const replayPlanning = async (sock, jid, steps, finalContent, {
    description = 'Thinking…',
    placeholderText = '',
    stepDelayMs = 900,
    finalPauseMs = 600,
    abortOnDisconnect = true,
    sendOptions = {}
} = {}) => {
    if (!steps?.length) {
        throw new Error('replayPlanning: steps array must have at least one entry');
    }

    // ── Track abort state if socket disconnects mid-replay ───────────────────
    let aborted = false;
    const onClose = () => { aborted = true; };
    if (abortOnDisconnect) {
        sock.ev?.once?.('connection.update', ({ connection }) => {
            if (connection === 'close') onClose();
        });
    }

    // ── 1. Build initial state — all steps IN_PROGRESS ───────────────────────
    const initialSteps = steps.map(step => ({
        ...step,
        status: PlanningStepStatus.IN_PROGRESS
    }));

    const placeholder = await sock.sendMessage(jid, {
        raw: true,
        ...buildReplayFrame(description, initialSteps, placeholderText)
    });

    const key = placeholder?.key;

    // ── 2. Replay loop — flip each step to DONE sequentially ─────────────────
    try {
        const currentSteps = [...initialSteps];

        for (let i = 0; i < currentSteps.length; i++) {
            if (aborted) break;

            await delay(stepDelayMs);
            if (aborted) break;

            // Flip this step to DONE
            currentSteps[i] = {
                ...currentSteps[i],
                status: PlanningStepStatus.DONE
            };

            if (key) {
                await editPlanningBubble(
                    sock, jid, key,
                    description, currentSteps, placeholderText
                );
            }
        }

        // ── 3. Hold with all steps DONE so user sees completion ──────────────
        if (!aborted && finalPauseMs > 0) {
            await delay(finalPauseMs);
        }

        // ── 4. Delete placeholder silently ───────────────────────────────────
        if (key && !aborted) {
            await sock.sendMessage(jid, { delete: key });
        }
    } catch (err) {
        // Non-fatal — always attempt final send even if replay failed mid-way
        try {
            if (key) await sock.sendMessage(jid, { delete: key });
        } catch (_) {}
    }

    // ── 5. Send the final rich message as a brand-new message — no edited badge ──
    return sock.sendMessage(jid, finalContent, sendOptions);
};

/**
 * replayPlanningOnly — same animation but WITHOUT sending a final message.
 * Use when you want to control the final send yourself.
 *
 * Returns { key } of the placeholder (already deleted on completion).
 *
 * @param {object} sock
 * @param {string} jid
 * @param {Array}  steps
 * @param {object} [options]   - Same options as replayPlanning minus sendOptions
 * @returns {Promise<void>}
 */
export const replayPlanningOnly = async (sock, jid, steps, options = {}) => {
    return replayPlanning(sock, jid, steps, null, {
        ...options,
        _skipFinalSend: true
    });
};

/**
 * buildReasoningSteps — convenience builder for steps with isReasoning: true.
 * Renders with the "reasoning" visual treatment in the Meta bubble.
 *
 * @example
 * buildReasoningSteps(['Analyzing the problem…', 'Checking edge cases…'])
 */
export const buildReasoningSteps = (titles) =>
    titles.map(title => ({ title, isReasoning: true }));

/**
 * buildSearchSteps — convenience builder for steps with isEnhancedSearch: true.
 * Renders with the "enhanced search" visual treatment.
 *
 * @example
 * buildSearchSteps(['Searching the web…', 'Reading top results…'])
 */
export const buildSearchSteps = (titles) =>
    titles.map(title => ({ title, isEnhancedSearch: true }));

/**
 * mixedSteps — build a steps array mixing reasoning + search + plain steps.
 * Pass an array of { title, type? } where type is 'reasoning' | 'search' | undefined.
 *
 * @example
 * mixedSteps([
 *   { title: 'Understanding your question…', type: 'reasoning' },
 *   { title: 'Searching for data…',          type: 'search' },
 *   { title: 'Writing the answer…' }
 * ])
 */
export const mixedSteps = (defs) =>
    defs.map(({ title, body, type }) => ({
        title,
        ...(body ? { body } : {}),
        ...(type === 'reasoning' ? { isReasoning: true } : {}),
        ...(type === 'search' ? { isEnhancedSearch: true } : {})
    }));
