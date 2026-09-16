// Global Playwright Setup

import { FullConfig } from '@playwright/test'
import { execSync } from 'child_process'

export default async function globalSetup(config: FullConfig) {
  console.log('🔧 Starting global E2E test setup...')
  
  try {
    // Start Docker services if not running
    console.log('🐳 Starting Docker services...')
    try {
      execSync('docker compose up -d', { 
        stdio: 'inherit',
        timeout: 120000,
        cwd: process.cwd(),
      })
      console.log('✅ Docker services started')
    } catch (error) {
      console.warn('⚠️  Docker compose might already be running:', error)
    }
    
    // Wait for services to be healthy
    console.log('⏳ Waiting for services to be healthy...')
    await waitForServices()
    
    // Run database migrations if needed
    console.log('🗄️  Running database migrations...')
    try {
      execSync('docker compose exec -T backend alembic upgrade head', {
        stdio: 'inherit',
        timeout: 60000,
        cwd: process.cwd(),
      })
      console.log('✅ Migrations completed')
    } catch (error) {
      console.warn('⚠️  Migrations might have already run:', error)
    }
    
    // Create test admin user if not exists
    console.log('👤 Creating test admin user...')
    try {
      execSync(`
        docker compose exec -T backend python -c "
from app.database import get_db
from app.models.user import User
from app.utils.security import hash_password
from sqlalchemy import select
from app.config import settings

async def create_test_admin():
    async for db in get_db():
        result = await db.execute(select(User).where(User.email == 'admin@test.com'))
        user = result.scalar_one_or_none()
        if not user:
            user = User(
                email='admin@test.com',
                password_hash=hash_password('admin123'),
                name='Admin Test',
                role='admin',
                business_type='restaurant',
                is_active=True,
            )
            db.add(user)
            await db.commit()
            print('✅ Test admin created')
        else:
            print('✅ Test admin already exists')
        break

import asyncio
asyncio.run(create_test_admin())
      `, {
        stdio: 'inherit',
        timeout: 30000,
        cwd: process.cwd(),
      })
    } catch (error) {
      console.warn('⚠️  Test admin might already exist:', error)
    }
    
    // Create test cashier user
    console.log('👤 Creating test cashier user...')
    try {
      execSync(`
        docker compose exec -T backend python -c "
from app.database import get_db
from app.models.user import User
from app.utils.security import hash_password
from sqlalchemy import select

async def create_test_cashier():
    async for db in get_db():
        result = await db.execute(select(User).where(User.email == 'cashier@test.com'))
        user = result.scalar_one_or_none()
        if not user:
            user = User(
                email='cashier@test.com',
                password_hash=hash_password('cashier123'),
                name='Cashier Test',
                role='cashier',
                business_type='restaurant',
                is_active=True,
            )
            db.add(user)
            await db.commit()
            print('✅ Test cashier created')
        else:
            print('✅ Test cashier already exists')
        break

import asyncio
asyncio.run(create_test_cashier())
      `, {
        stdio: 'inherit',
        timeout: 30000,
        cwd: process.cwd(),
      })
    } catch (error) {
      console.warn('⚠️  Test cashier might already exist:', error)
    }
    
    // Create test grocery user
    console.log('🛒 Creating test grocery user...')
    try {
      execSync(`
        docker compose exec -T backend python -c "
from app.database import get_db
from app.models.user import User
from app.utils.security import hash_password
from sqlalchemy import select

async def create_test_grocery():
    async for db in get_db():
        result = await db.execute(select(User).where(User.email == 'grocery@test.com'))
        user = result.scalar_one_or_none()
        if not user:
            user = User(
                email='grocery@test.com',
                password_hash=hash_password('grocery123'),
                name='Grocery Cashier',
                role='cashier',
                business_type='grocery',
                is_active=True,
            )
            db.add(user)
            await db.commit()
            print('✅ Test grocery user created')
        else:
            print('✅ Test grocery user already exists')
        break

import asyncio
asyncio.run(create_test_grocery())
      `, {
        stdio: 'inherit',
        timeout: 30000,
        cwd: process.cwd(),
      })
    } catch (error) {
      console.warn('⚠️  Test grocery user might already exist:', error)
    }
    
    console.log('✅ Global setup completed!')
  }

async function waitForServices(maxAttempts = 30): {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch('https://pos.local/health', {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      })
      if (response.ok) {
        console.log('✅ Services are healthy!')
        return
      }
    } catch (error) {
      // Ignore errors, keep retrying
    }
    
    console.log(`⏳ Waiting for services... (${i + 1}/${maxAttempts})`)
    await new Promise(resolve => setTimeout(resolve, 5000))
  }
  
  throw new Error('❌ Services did not become healthy in time')
}