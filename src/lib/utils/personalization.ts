type PersonalizationInput = {
  location?: string;
  profile?: string;
};

const PRIVACY_DIRECTIVE =
  '- Treat these details as private user context. Never repeat them verbatim or expose them unless the user explicitly requests it.';
const RELEVANCE_DIRECTIVE =
  '- Use this context only when it clearly improves answer quality, relevance, or tone. If it does not meaningfully enhance the response, ignore it.';
const SAFETY_DIRECTIVE =
  '- Do not include these details in external tool calls, web requests, or citations.';
const AUTHORITY_DIRECTIVE =
  '- If new instructions from the user conflict with this context, follow the latest user message.';

export function buildPersonalizationSection({
  location,
  profile,
}: PersonalizationInput): string {
  const trimmedLocation = location?.trim() || '';
  const trimmedProfile = profile?.trim() || '';

  if (!trimmedLocation && !trimmedProfile) {
    return '';
  }

  const lines = [
    '## Personalization',
    PRIVACY_DIRECTIVE,
    RELEVANCE_DIRECTIVE,
    SAFETY_DIRECTIVE,
    AUTHORITY_DIRECTIVE,
  ];

  if (trimmedLocation) {
    lines.push(
      `- Location Context: ${trimmedLocation}. Prefer locally relevant sources and examples only when it improves the answer; otherwise, proceed normally.`,
    );
  }

  if (trimmedProfile) {
    lines.push(
      `- User Context: ${trimmedProfile}. Use this only to tailor explanations, examples, or tone when it adds clear value.`,
    );
  }

  return lines.join('\n');
}

export type { PersonalizationInput };
