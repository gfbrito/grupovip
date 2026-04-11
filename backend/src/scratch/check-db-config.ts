import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Diagnóstico AppConfig ---');
  const configs = await prisma.appConfig.findMany();
  console.log(`Total de registros: ${configs.length}`);
  
  configs.forEach(c => {
    console.log(`ID: ${c.id}`);
    console.log(`URL: ${c.evolutionUrl}`);
    console.log(`Instância: ${c.instanceName}`);
    console.log(`Configurado: ${c.isConfigured}`);
    console.log(`Tem Key: ${!!c.evolutionKey}`);
    console.log('---');
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
