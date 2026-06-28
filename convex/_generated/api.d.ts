/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as dictations from "../dictations.js";
import type * as elevenlabs from "../elevenlabs.js";
import type * as fillInBlank from "../fillInBlank.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_elevenlabsTts from "../lib/elevenlabsTts.js";
import type * as lib_englishVoices from "../lib/englishVoices.js";
import type * as lib_geminiText from "../lib/geminiText.js";
import type * as lib_voiceSampleLadder from "../lib/voiceSampleLadder.js";
import type * as users from "../users.js";
import type * as voiceClips from "../voiceClips.js";
import type * as voicePreviewSamples from "../voicePreviewSamples.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  dictations: typeof dictations;
  elevenlabs: typeof elevenlabs;
  fillInBlank: typeof fillInBlank;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/elevenlabsTts": typeof lib_elevenlabsTts;
  "lib/englishVoices": typeof lib_englishVoices;
  "lib/geminiText": typeof lib_geminiText;
  "lib/voiceSampleLadder": typeof lib_voiceSampleLadder;
  users: typeof users;
  voiceClips: typeof voiceClips;
  voicePreviewSamples: typeof voicePreviewSamples;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
