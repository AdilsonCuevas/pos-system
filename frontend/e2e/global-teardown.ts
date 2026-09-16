// Global Playwright Teardown

import { FullConfig } from '@playwright/test'
import { execSync } from 'child_process'

export default async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global E2E test teardown...')
  
  try {
    // Clean up test data
    console.log('🗑️  Cleaning up test data...')
    try {
      execSync(`
        docker compose exec -T backend python -c "
from app.database import get_db
from app.models.pos import Sale, SaleItem
from app.models.inventory import InventoryMovement
from app.models.fde import FDEDocument
from app.models.sync import SyncQueue
from sqlalchemy import delete
from sqlalchemy import select

async def cleanup():
    async for db in get_db():
        # Clean up test sales
        await db.execute(delete(Sale).where(Sale.sale_number.like('POS-E2E%')))
        await db.execute(delete(SaleItem).where(SaleItem.sale_id.in_(
            select(Sale.id).where(Sale.sale_number.like('POS-E2E%'))
        )))
        await db.execute(delete(InventoryMovement).where(InventoryMovement.reference.like('E2E%')))
        await db.execute(delete(FDEDocument).where(FDEDocument.cufe.like('E2E%')))
        await db.execute(delete(SyncQueue).where(SyncQueue.device_id.like('device-%')))
        await db.commit()
        print('✅ Test data cleaned up')
        break

import asyncio
asyncio.run(cleanup())
      `, {
        stdio: 'inherit',
        timeout: 30000,
        cwd: process.cwd(),
      })
    } catch (error) {
      console.warn('⚠️  Cleanup might have failed:', error)
    }
    
    // Optionally stop Docker services (commented out for CI reuse)
    // console.log('🛑 Stopping Docker services...')
    // try {
    //   execSync('docker compose down', {
    //     stdio: 'inherit',
    //     timeout: 60000,
    //     cwd: process.cwd(),
    //   })
    // } catch (error) {
    //   console.warn('⚠️  Docker compose down failed:', error)
    // }
    
    console.log('✅ Global teardown completed!')
  } catch (error) {
    console.error('❌ Global teardown failed:', error)
    // Don't throw - let tests complete
  }
}