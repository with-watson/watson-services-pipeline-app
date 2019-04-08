import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { ClarityModule } from '@clr/angular';

import { LoginComponent } from './login/login.component';
import { LoopbackAuthService } from './loopback/loopback-auth.service';
import { AuthGuard } from './auth.guard';
import { HttpTestComponent } from './api-test/http-test.component';
import { UserManagementComponent } from './user-management/user-management.component';

@NgModule({
  imports:      [ CommonModule, HttpClientModule, FormsModule, ReactiveFormsModule, ClarityModule ],
  declarations: [ LoginComponent, HttpTestComponent, UserManagementComponent ],
  providers:    [ LoopbackAuthService, AuthGuard ],
  exports:      [ LoginComponent, HttpTestComponent ]
})

export class AuthModule {
  constructor() { }
}
