import { NgModule } from '@angular/core';

import { RouterModule, Routes } from '@angular/router';

import { AuthGuard } from './auth/auth.guard';
import { LoginComponent } from './auth/login/login.component';
import { PageNotFoundComponent } from './page-not-found/page-not-found.component';
import { HomeComponent } from './home/home.component';
import { OverviewComponent } from './overview/overview.component';
import { InstanceDetailsComponent } from './instance-details/instance-details.component';
import { PipelineDefinitionComponent } from './pipeline-definition/pipeline-definition.component';
import { UserManagementComponent } from './auth/user-management/user-management.component';

const APP_ROUTES: Routes = [
  { path: '', redirectTo: 'home/overview', pathMatch: 'full' },  
  { path: 'home', component: HomeComponent, canActivate: [ AuthGuard ],
    children: [
      { path: 'user-management', component: UserManagementComponent },
      { path: 'overview', component: OverviewComponent },
      { path: 'pipeline-definition', component: PipelineDefinitionComponent },
      { path: 'instance-details/:id', component: InstanceDetailsComponent }
    ]
  },
  { path: 'login', component: LoginComponent },
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
