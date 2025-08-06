import { Controller, Post, Get, Body } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  create(@Body() body: { username: string; password: string; role: string }) {
    return this.usersService.create(body.username, body.password, body.role);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }
}
