/**
 * Security patterns for detecting and preventing common threats.
 * Each rule has a stable `id` for use in threat events and test assertions.
 */

import type { SecurityPattern } from './types';
import { ThreatType } from './types';

/**
 * Core security patterns applied in every mode.
 */
export const SECURITY_PATTERNS: SecurityPattern[] = [
  // ── Task override attempts ───────────────────────────────────────────────
  {
    id: 'task_override_ignore',
    pattern:
      /(?:^|\W)(ignore|forget|disregard|bypass|skip|stop)(?:[\s\-_]+(?:all|the|your|my|those|these|prior|previous|of|please|now|listen|to|me|just|instead)*)*[\s\-_]+(?:instructions?|tasks?|commands?|directives?|rules?|guardrails?)(?:\W|$)/gi,
    type: ThreatType.TASK_OVERRIDE,
    description: 'Attempt to override previous instructions',
    replacement: '[BLOCKED_OVERRIDE_ATTEMPT]',
  },
  {
    id: 'task_override_new_task',
    pattern: /\b(your?|the)[\s\-_]*new[\s\-_]*(task|instruction|goal|objective)[\s\-_]*(is|are|:)/gi,
    type: ThreatType.TASK_OVERRIDE,
    description: 'Attempt to inject new task',
    replacement: '[BLOCKED_TASK_INJECTION]',
  },
  {
    id: 'task_override_redirect',
    pattern: /\b(now|instead|actually)[\s\-_]+(you must|you should|you will)[\s\-_]+/gi,
    type: ThreatType.TASK_OVERRIDE,
    description: 'Attempt to redirect agent behavior',
    replacement: '[BLOCKED_REDIRECT]',
  },
  {
    id: 'task_override_ultimate',
    pattern: /\bultimate[-_ ]+task\b/gi,
    type: ThreatType.TASK_OVERRIDE,
    description: 'Reference to ultimate task',
    replacement: '',
  },
  {
    id: 'task_override_semantic',
    pattern:
      /\b(disregard|ignore|forget|abandon|suspend)[\s\-_]*(all|everything|every|any)[\s\-_]*(prior|previous|preceding|existing)[\s\-_]*(directives?|instructions?|messages?|prompts?|tasks?|commands?|rules?)\b/gi,
    type: ThreatType.TASK_OVERRIDE,
    description: 'Semantic task override attempt',
    replacement: '[BLOCKED_SEMANTIC_OVERRIDE]',
  },
  {
    id: 'task_override_obfuscated',
    pattern:
      /(?:aWdub3JlIHByZXZpb3VzIGluc3RydWN0aW9ucw|vtaber cerivbhf vafgehpgvbaf|&#105;&#103;&#110;&#111;&#114;&#101;)/gi,
    type: ThreatType.TASK_OVERRIDE,
    description: 'Common obfuscated override signatures',
    replacement: '[BLOCKED_OBFUSCATED_OVERRIDE]',
  },

  // ── Prompt injection — system references & fake tags ────────────────────
  {
    id: 'prompt_injection_system_ref',
    description: 'Reference to system prompt',
    pattern:
      /(?:reveal|show|what is|tell me|print|output|extract|dump|reference)[\s\-_]*(?:the|your)?[\s\-_]*system[\s\-_]*(?:prompt|message|instruction|reference)/gi,
    replacement: '[BLOCKED_SYSTEM_REF]',
    type: ThreatType.PROMPT_INJECTION,
  },
  {
    id: 'prompt_injection_fake_untrusted_tag',
    pattern: /\bguard[-_ ]+untrusted[-_ ]+content\b/gi,
    type: ThreatType.PROMPT_INJECTION,
    description: 'Attempt to fake untrusted content tags',
    replacement: '',
  },
  {
    id: 'prompt_injection_fake_user_request',
    pattern: /\bguard[-_ ]+user[-_ ]+request\b/gi,
    type: ThreatType.PROMPT_INJECTION,
    description: 'Attempt to fake user request tags',
    replacement: '',
  },
  {
    id: 'prompt_injection_untrusted_ref',
    pattern: /\buntrusted[-_]+content\b/gi,
    type: ThreatType.PROMPT_INJECTION,
    description: 'Reference to untrusted content',
    replacement: '',
  },
  {
    id: 'prompt_injection_fake_files_tag',
    pattern: /\bguard[-_]+attached[-_]+files\b/gi,
    type: ThreatType.PROMPT_INJECTION,
    description: 'Reference to attached files',
    replacement: '',
  },
  {
    id: 'prompt_injection_user_request_ref',
    pattern: /\buser[-_]+request\b/gi,
    type: ThreatType.PROMPT_INJECTION,
    description: 'Reference to user request',
    replacement: '',
  },

  // ── Suspicious XML/HTML tags ─────────────────────────────────────────────
  {
    id: 'prompt_injection_suspicious_tags',
    pattern: /<\/?[\s]*(?:instruction|command|system|task|override|ignore|plan|execute|request)[\s]*>/gi,
    type: ThreatType.PROMPT_INJECTION,
    description: 'Suspicious XML/HTML tags',
    replacement: '',
  },
  {
    id: 'prompt_injection_xml_cdata',
    pattern: /\]\]>|<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/gi,
    type: ThreatType.PROMPT_INJECTION,
    description: 'XML injection attempt',
    replacement: '',
  },

  // ── Sensitive data ───────────────────────────────────────────────────────
  {
    id: 'sensitive_data_ssn',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    type: ThreatType.SENSITIVE_DATA,
    description: 'Potential SSN detected',
    replacement: '[REDACTED_SSN]',
  },
  {
    id: 'sensitive_data_cc',
    pattern: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g,
    type: ThreatType.SENSITIVE_DATA,
    description: 'Potential credit card number',
    replacement: '[REDACTED_CC]',
  },
];

/**
 * Additional patterns enabled in strict mode.
 */
export const STRICT_PATTERNS: SecurityPattern[] = [
  {
    id: 'sensitive_data_credential',
    pattern: /\b(password|pwd|passwd|api[\s_-]*key|secret|token)\s*[:=]\s*["']?[\w-]+["']?/gi,
    type: ThreatType.SENSITIVE_DATA,
    description: 'Credential detected',
    replacement: '[REDACTED_CREDENTIAL]',
    strictOnly: true,
  },
  {
    id: 'sensitive_data_email',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    type: ThreatType.SENSITIVE_DATA,
    description: 'Email address detected',
    replacement: '[EMAIL]',
    strictOnly: true,
  },
  {
    id: 'prompt_injection_bypass',
    pattern: /\b(bypass|circumvent|avoid|skip)[\s\-_]*(security|safety|filter|check)/gi,
    type: ThreatType.PROMPT_INJECTION,
    description: 'Security bypass attempt',
    replacement: '[BLOCKED_BYPASS]',
    strictOnly: true,
  },
  {
    id: 'prompt_injection_context_switch',
    pattern:
      /\b(kernel developer|safety layers?|debugging|debugger|engineer|admin|superuser).{1,50}?(bypass|override|disable|skip|suspend)/gi,
    type: ThreatType.PROMPT_INJECTION,
    description: 'Context-switching override attempt',
    replacement: '[BLOCKED_CONTEXT_SWITCH]',
    strictOnly: true,
  },
  {
    id: 'sensitive_data_phone',
    pattern: /(?:\+?\d{1,4}[\s\-_]?)?\(?\d{2,5}\)?(?:[\s\-_]?\d{2,5}){1,3}/gi,
    type: ThreatType.SENSITIVE_DATA,
    description: 'Phone number detected',
    replacement: '[PHONE]',
    strictOnly: true,
  },
  {
    id: 'prompt_injection_roleplay',
    pattern:
      /\b(you are now|act as|pretend to be|imagine you are|immerse yourself into the role of|known as)[\s\-_]+(?:a|an|the|another|model)?[\s\-_]*(jailbroken|unfiltered|unrestricted|god[_-]?mode|dan)\b/gi,
    type: ThreatType.PROMPT_INJECTION,
    description: 'Adversarial roleplay attempt',
    replacement: '[BLOCKED_ROLEPLAY]',
    strictOnly: true,
  },
  {
    id: 'prompt_injection_semantic_wide',
    pattern:
      /\b(disregard|ignore|listen to me|overrule)(?:\s+(?:all|the|your|my|those|these|prior|previous|of|directed|directives|directives?|directives|history|prior)\s+)*(?:directives?|history|everything|prior)\b/gi,
    type: ThreatType.PROMPT_INJECTION,
    description: 'Broad semantic override',
    replacement: '[BLOCKED_SEMANTIC]',
    strictOnly: true,
  },
];

/**
 * Get patterns based on security level.
 * @param strict - Whether to include strict-only patterns
 */
export function getPatterns(strict: boolean = false): SecurityPattern[] {
  return strict ? [...SECURITY_PATTERNS, ...STRICT_PATTERNS] : SECURITY_PATTERNS;
}

/**
 * Tags to preserve during sanitization (wrapped content tags used by the agent).
 */
export const PRESERVED_TAGS = [
  'guard_untrusted_content',
  'guard_user_request',
  'guard_attached_files',
  'guard_file_content',
];

/**
 * Check if a tag should be preserved during sanitization.
 */
export function isPreserveTag(tag: string): boolean {
  const tagName = tag.replace(/<\/?|\s|>/g, '').toLowerCase();
  return PRESERVED_TAGS.includes(tagName);
}
