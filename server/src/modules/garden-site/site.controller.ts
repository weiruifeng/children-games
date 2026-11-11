import {
  Inject,
  Body,
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Query,
  Req,
  Res,
  HttpCode,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { GardenService } from './garden.service';
import { cookieName, cookieOptions, authScope, type SiteRequest } from './core';
@Controller()
export class SiteController {
  constructor(
    @Inject(AuthService) private auth: AuthService,
    @Inject(GardenService) private garden: GardenService,
  ) {}
  @Get('health') health() {
    return { ok: true };
  }
  @Get('ready') async ready() {
    await this.auth.rows('SELECT 1 FROM garden_user LIMIT 1');
    return { ok: true };
  }
  @Post('auth/register') register(@Body() b: unknown) {
    return this.auth.register(b);
  }
  @Post(['auth/login', 'admin/auth/login']) @HttpCode(200) async login(
    @Body() b: unknown,
    @Req() r: SiteRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(b, authScope(r.path));
    res.cookie(cookieName(authScope(r.path)), result.raw, {
      ...cookieOptions(),
      expires: result.expires,
    });
    return { user: result.user };
  }
  @Get(['auth/me', 'admin/auth/me']) me(@Req() r: SiteRequest) {
    return {
      user: { id: r.actor!.id, username: r.actor!.username, role: r.actor!.role },
      csrfToken: r.actor!.csrf,
    };
  }
  @Post(['auth/logout', 'admin/auth/logout']) @HttpCode(204) async logout(
    @Req() r: SiteRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(r.actor!);
    res.clearCookie(cookieName(authScope(r.path)), cookieOptions());
  }
  @Post(['auth/change-password', 'admin/auth/change-password']) @HttpCode(204) change(
    @Req() r: SiteRequest,
    @Body() b: unknown,
  ) {
    return this.auth.change(r.actor!, b);
  }
  @Post('auth/reset-password') @HttpCode(204) reset(@Body() b: unknown) {
    return this.auth.reset(b);
  }
  @Get('admin/invitations') invites(@Query() q: Record<string, unknown>) {
    return this.auth.adminList('invitations', q);
  }
  @Get('admin/users') users(@Query() q: Record<string, unknown>) {
    return this.auth.adminList('users', q);
  }
  @Get('admin/audit') audit(@Query() q: Record<string, unknown>) {
    return this.auth.adminList('audit', q);
  }
  @Post('admin/invitations') create(@Req() r: SiteRequest, @Body() b: unknown) {
    return this.auth.invites(r.actor!, b);
  }
  @Post('admin/invitations/:id/revoke') @HttpCode(204) revoke(
    @Req() r: SiteRequest,
    @Param('id') id: string,
  ) {
    return this.auth.revoke(r.actor!, id);
  }
  @Patch('admin/users/:id/status') status(
    @Req() r: SiteRequest,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.auth.userStatus(r.actor!, id, b);
  }
  @Post('admin/users/:id/password-reset') issue(@Req() r: SiteRequest, @Param('id') id: string) {
    return this.auth.issueReset(r.actor!, id);
  }
  @Get('garden/profiles') list(@Req() r: SiteRequest) {
    return this.garden.list(r.actor!);
  }
  @Get('garden/profiles/:slot') get(@Req() r: SiteRequest, @Param('slot') slot: string) {
    return this.garden.get(r.actor!, Number(slot));
  }
  @Put('garden/profiles/:slot') save(
    @Req() r: SiteRequest,
    @Param('slot') slot: string,
    @Body() b: unknown,
  ) {
    return this.garden.mutate(r.actor!, Number(slot), b, 'save');
  }
  @Post('garden/profiles/:slot/clear') clear(
    @Req() r: SiteRequest,
    @Param('slot') slot: string,
    @Body() b: unknown,
  ) {
    return this.garden.mutate(r.actor!, Number(slot), b, 'clear');
  }
  @Post('garden/profiles/:slot/delete-history') erase(
    @Req() r: SiteRequest,
    @Param('slot') slot: string,
    @Body() b: unknown,
  ) {
    return this.garden.mutate(r.actor!, Number(slot), b, 'delete-history');
  }
  @Post('garden/profiles/:slot/events') events(
    @Req() r: SiteRequest,
    @Param('slot') slot: string,
    @Body() b: unknown,
  ) {
    return this.garden.events(r.actor!, Number(slot), b);
  }
  @Get('garden/profiles/:slot/events') readEvents(
    @Req() r: SiteRequest,
    @Param('slot') slot: string,
    @Query() q: unknown,
  ) {
    return this.garden.readEvents(r.actor!, Number(slot), q);
  }
  @Get('garden/profiles/:slot/summary') summary(
    @Req() r: SiteRequest,
    @Param('slot') slot: string,
  ) {
    return this.garden.summary(r.actor!, Number(slot));
  }
  @Post('garden/archives') archive(@Req() r: SiteRequest, @Body() b: unknown) {
    return this.garden.archive(r.actor!, b);
  }
  @Get('garden/archives') archives(@Req() r: SiteRequest) {
    return this.garden.archives(r.actor!);
  }
  @Get('garden/archives/:id') readArchive(@Req() r: SiteRequest, @Param('id') id: string) {
    return this.garden.archives(r.actor!, id);
  }
}
