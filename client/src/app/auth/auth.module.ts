import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { LoginComponent } from './login/login.component';
import { LoopbackAuthService } from './loopback/loopback-auth.service';
import { AuthGuard } from './auth.guard';
import { HttpTestComponent } from './api-test/http-test.component';

@NgModule({
  imports:      [ CommonModule, HttpClientModule, FormsModule ],
  declarations: [ LoginComponent, HttpTestComponent ],
  providers:    [ LoopbackAuthService, AuthGuard ],
  exports:      [ LoginComponent, HttpTestComponent ]
})

export class AuthModule {
  constructor() { }
}
