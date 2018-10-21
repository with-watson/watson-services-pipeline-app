import { NgModule } from '@angular/core';

import { RouterModule, Routes, RouterOutlet } from '@angular/router';

import { AuthGuard } from './auth/auth.guard';
import { LoginComponent } from './auth/login/login.component';
import { PageNotFoundComponent } from './page-not-found/page-not-found.component';
import { HomeComponent } from './home/home.component';
import { HttpTestComponent } from './auth/api-test/http-test.component';

const APP_ROUTES: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent, canActivate: [ AuthGuard ] },
  { path: 'login', component: LoginComponent },
  { path: 'api-test', component: HttpTestComponent },
  { path: '**', component: PageNotFoundComponent }
];

@NgModule({
  imports: [
    RouterModule.forRoot(APP_ROUTES)
  ],
  exports: [
    RouterModule
  ]
})
export class AppRoutingModule { }
