import { db } from '../db/index.js';
import { deidentificationConfigs, sources } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { NotFoundError, BadRequestError } from '../errors/index.js';
import * as sourceService from './source.service.js';

type PIIType = 'email' | 'phone' | 'name' | 'address' | 'ssn' | 'credit_card' | 'dob';
type MaskingStrategy = 'replacement' | 'redaction' | 'pseudonymization';

interface CustomPattern {
  name: string;
  pattern: string;
  replacement: string;
}

// PII detection patterns
const PII_PATTERNS: Record<PIIType, RegExp> = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  name: /\b[A-Z][a-z]+\s[A-Z][a-z]+\b/g,
  address: /\d+\s+[\w\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd)\b/gi,
  ssn: /\d{3}-\d{2}-\d{4}/g,
  credit_card: /\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/g,
  dob: /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/g,
};

// Replacement labels
const REPLACEMENT_LABELS: Record<PIIType, string> = {
  email: '[EMAIL]',
  phone: '[PHONE]',
  name: '[NAME]',
  address: '[ADDRESS]',
  ssn: '[SSN]',
  credit_card: '[CREDIT_CARD]',
  dob: '[DOB]',
};

/**
 * Get deidentification config for source.
 */
export async function getDeidentificationConfig(sourceId: number, organisationId: number) {
  // Verify source access
  await sourceService.verifySourceAccess(sourceId, organisationId);

  const config = await db.query.deidentificationConfigs.findFirst({
    where: eq(deidentificationConfigs.sourceId, sourceId),
  });

  if (!config) {
    throw new NotFoundError('Deidentification config');
  }

  return config;
}

/**
 * Update deidentification config.
 */
export async function updateDeidentificationConfig(
  sourceId: number,
  organisationId: number,
  data: {
    enabledTypes?: PIIType[];
    customPatterns?: CustomPattern[];
    maskingStrategy?: MaskingStrategy;
  }
) {
  // Verify source access
  await sourceService.verifySourceAccess(sourceId, organisationId);

  const existing = await db.query.deidentificationConfigs.findFirst({
    where: eq(deidentificationConfigs.sourceId, sourceId),
  });

  if (!existing) {
    throw new NotFoundError('Deidentification config');
  }

  // Validate custom patterns
  if (data.customPatterns) {
    for (const pattern of data.customPatterns) {
      try {
        new RegExp(pattern.pattern);
      } catch {
        throw new BadRequestError(`Invalid regex pattern: ${pattern.name}`);
      }
    }
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
    isConfigured: true,
  };

  if (data.enabledTypes !== undefined) {
    updates.enabledTypes = data.enabledTypes;
  }

  if (data.customPatterns !== undefined) {
    updates.customPatterns = data.customPatterns;
  }

  if (data.maskingStrategy !== undefined) {
    updates.maskingStrategy = data.maskingStrategy;
  }

  const [updated] = await db
    .update(deidentificationConfigs)
    .set(updates)
    .where(eq(deidentificationConfigs.sourceId, sourceId))
    .returning();

  return updated;
}

/**
 * Preview deidentification on sample data.
 */
export async function previewDeidentification(sourceId: number, organisationId: number) {
  // Verify source access
  const source = await sourceService.verifySourceAccess(sourceId, organisationId);

  const config = await db.query.deidentificationConfigs.findFirst({
    where: eq(deidentificationConfigs.sourceId, sourceId),
  });

  if (!config) {
    throw new NotFoundError('Deidentification config');
  }

  // Get cached data or sample
  const cachedData = (source.cachedData as unknown[] | null) || [];
  const sampleData = cachedData.slice(0, 100);

  const enabledTypes = config.enabledTypes as PIIType[];
  const customPatterns = config.customPatterns as CustomPattern[];
  const strategy = config.maskingStrategy as MaskingStrategy;

  // Process each record
  const previewRecords = (sampleData as Record<string, unknown>[]).map((record) => {
    const processed: Record<string, unknown> = {};
    const detections: Array<{ field: string; type: string; original: string; masked: string }> = [];

    for (const [key, value] of Object.entries(record)) {
      if (typeof value !== 'string') {
        processed[key] = value;
        continue;
      }

      let maskedValue = value;

      // Apply built-in patterns
      for (const type of enabledTypes) {
        const pattern = PII_PATTERNS[type];
        const matches = value.match(pattern) || [];
        for (const match of matches) {
          const replacement = getMaskValue(type, strategy);
          maskedValue = maskedValue.replace(match, replacement);
          detections.push({
            field: key,
            type,
            original: match,
            masked: replacement,
          });
        }
      }

      // Apply custom patterns
      for (const custom of customPatterns) {
        try {
          const regex = new RegExp(custom.pattern, 'g');
          const matches = value.match(regex) || [];
          for (const match of matches) {
            maskedValue = maskedValue.replace(match, custom.replacement);
            detections.push({
              field: key,
              type: custom.name,
              original: match,
              masked: custom.replacement,
            });
          }
        } catch {
          // Skip invalid patterns
        }
      }

      processed[key] = maskedValue;
    }

    return { original: record, processed, detections };
  });

  return {
    previewRecords,
    totalRecords: cachedData.length,
    previewCount: previewRecords.length,
  };
}

function getMaskValue(type: PIIType, strategy: MaskingStrategy): string {
  switch (strategy) {
    case 'replacement':
      return REPLACEMENT_LABELS[type];
    case 'redaction':
      return '[REDACTED]';
    case 'pseudonymization':
      // In real implementation, would generate consistent fake values
      return `[PSEUDO_${type.toUpperCase()}]`;
    default:
      return REPLACEMENT_LABELS[type];
  }
}

/**
 * Apply deidentification to data.
 */
export function deidentifyData(
  data: unknown[],
  enabledTypes: PIIType[],
  customPatterns: CustomPattern[],
  strategy: MaskingStrategy
): unknown[] {
  return (data as Record<string, unknown>[]).map((record) => {
    const processed: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(record)) {
      if (typeof value !== 'string') {
        processed[key] = value;
        continue;
      }

      let maskedValue = value;

      // Apply built-in patterns
      for (const type of enabledTypes) {
        const pattern = PII_PATTERNS[type];
        maskedValue = maskedValue.replace(pattern, getMaskValue(type, strategy));
      }

      // Apply custom patterns
      for (const custom of customPatterns) {
        try {
          const regex = new RegExp(custom.pattern, 'g');
          maskedValue = maskedValue.replace(regex, custom.replacement);
        } catch {
          // Skip invalid patterns
        }
      }

      processed[key] = maskedValue;
    }

    return processed;
  });
}
