import { db, closeDatabase } from './index.js';
import {
  organizations,
  users,
  projects,
  sources,
  schemaMappings,
  deidentificationConfigs,
  processingConfigs,
} from './schema.js';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('Seeding database...');

  // Create test organization
  const [org] = await db
    .insert(organizations)
    .values({ name: 'Acme Corp' })
    .returning();

  console.log(`Created organization: ${org.name} (ID: ${org.id})`);

  // Create admin user
  const [adminUser] = await db
    .insert(users)
    .values({
      organizationId: org.id,
      email: 'admin@example.com',
      passwordHash: await bcrypt.hash('Admin123!', 10),
      name: 'Admin User',
      role: 'admin',
    })
    .returning();

  console.log(`Created admin user: ${adminUser.email}`);

  // Create member user
  const [memberUser] = await db
    .insert(users)
    .values({
      organizationId: org.id,
      email: 'member@example.com',
      passwordHash: await bcrypt.hash('Member123!', 10),
      name: 'Team Member',
      role: 'member',
    })
    .returning();

  console.log(`Created member user: ${memberUser.email}`);

  // Create sample project
  const [project] = await db
    .insert(projects)
    .values({
      organizationId: org.id,
      name: 'Support Ticket Analysis',
      description: 'Preparing support tickets for AI agent training',
    })
    .returning();

  console.log(`Created project: ${project.name}`);

  // Create processing config for project
  await db.insert(processingConfigs).values({
    projectId: project.id,
    stages: [
      { name: 'ingest', enabled: true, config: {} },
      { name: 'normalize', enabled: true, config: {} },
      { name: 'deidentify', enabled: true, config: {} },
      { name: 'filter', enabled: true, config: {} },
      { name: 'export', enabled: true, config: {} },
    ],
    filters: {
      minMessageLength: 10,
      requireCompleteConversation: true,
    },
    exportFormat: 'jsonl',
    isConfigured: true,
  });

  // Create sample file source
  const [source] = await db
    .insert(sources)
    .values({
      projectId: project.id,
      name: 'January Tickets Export',
      type: 'file',
      status: 'ready',
      fileName: 'tickets-jan-2026.csv',
      fileType: 'csv',
      detectedFields: [
        { name: 'ticket_id', type: 'string', samples: ['T-001', 'T-002'] },
        { name: 'customer_email', type: 'string', samples: ['john@example.com'] },
        { name: 'message', type: 'string', samples: ['Hello, I need help...'] },
        { name: 'agent_response', type: 'string', samples: ['Hi John, I can help...'] },
      ],
    })
    .returning();

  console.log(`Created source: ${source.name}`);

  // Create schema mapping for source
  await db.insert(schemaMappings).values({
    sourceId: source.id,
    mappings: [
      { sourceField: 'ticket_id', targetField: 'conversation_id', confidence: 'high' },
      { sourceField: 'customer_email', targetField: 'user_id', confidence: 'medium' },
      { sourceField: 'message', targetField: 'user_message', confidence: 'high' },
      { sourceField: 'agent_response', targetField: 'assistant_message', confidence: 'high' },
    ],
    targetSchema: 'conversation',
    isConfigured: true,
  });

  // Create deidentification config for source
  await db.insert(deidentificationConfigs).values({
    sourceId: source.id,
    enabledTypes: ['email', 'phone', 'name'],
    customPatterns: [],
    maskingStrategy: 'replacement',
    isConfigured: true,
  });

  console.log('Seed complete!');
  console.log('\nTest Credentials:');
  console.log('  Admin: admin@example.com / Admin123!');
  console.log('  Member: member@example.com / Member123!');

  await closeDatabase();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
