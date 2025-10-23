/**
 * NestJS Integration Example
 * 
 * This example shows how to use the TypeORM adapter in a NestJS application
 */

import { Module, OnModuleInit, Injectable } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { betterAuth } from 'better-auth';
import { typeormAdapter } from 'better-auth-typeorm-adapter';
import { DataSource } from 'typeorm';
import { User, Account, Session, Verification } from './entities';

// 1. Auth Service
@Injectable()
export class AuthService {
  public auth: ReturnType<typeof betterAuth>;

  constructor(private dataSource: DataSource) {
    this.auth = betterAuth({
      database: typeormAdapter({
        dataSource: this.dataSource,
        debugLogs: process.env.NODE_ENV === 'development',
      }),
      
      emailAndPassword: {
        enabled: true,
      },
      
      session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
      },
    });
  }

  // Helper methods
  async signIn(email: string, password: string) {
    return this.auth.api.signInEmail({
      body: { email, password },
    });
  }

  async signUp(email: string, password: string, name: string) {
    return this.auth.api.signUpEmail({
      body: { email, password, name },
    });
  }

  async getSession(token: string) {
    return this.auth.api.getSession({
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
  }
}

// 2. Auth Module
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [User, Account, Session, Verification],
      synchronize: false,
    }),
    TypeOrmModule.forFeature([User, Account, Session, Verification]),
  ],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule implements OnModuleInit {
  constructor(private authService: AuthService) {}

  async onModuleInit() {
    console.log('✅ Better Auth initialized with TypeORM adapter');
  }
}

// 3. Auth Controller
import { Controller, Post, Body, Get, Headers } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('sign-in')
  async signIn(@Body() body: { email: string; password: string }) {
    return this.authService.signIn(body.email, body.password);
  }

  @Post('sign-up')
  async signUp(@Body() body: { email: string; password: string; name: string }) {
    return this.authService.signUp(body.email, body.password, body.name);
  }

  @Get('session')
  async getSession(@Headers('authorization') auth: string) {
    const token = auth?.replace('Bearer ', '');
    return this.authService.getSession(token);
  }
}

