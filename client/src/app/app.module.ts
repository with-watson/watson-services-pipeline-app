import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'

import { NgModule } from '@angular/core';
import { ClarityModule } from '@clr/angular'

import { FormsModule, ReactiveFormsModule }   from '@angular/forms';

import { AppComponent } from './app.component';
import { AuthModule } from './auth/auth.module';
import { AppRoutingModule } from './app-routing.module';
import { HomeComponent } from './home/home.component';
import { PageNotFoundComponent } from './page-not-found/page-not-found.component';
import { HeaderComponent } from './header/header.component';
import { OverviewComponent } from './overview/overview.component';
import { InstancesTabComponent } from './instances-tab/instances-tab.component';
import { InstancesTableComponent } from './instances-table/instances-table.component';
import { InstanceDetailsComponent } from './instance-details/instance-details.component'
import { NgxJsonViewerModule } from 'ngx-json-viewer';
import { CosListComponent } from './cos-list/cos-list.component';
import { PipelineDefinitionComponent } from './pipeline-definition/pipeline-definition.component';
import { ChangePasswordComponent } from './auth/change-password/change-password.component';

@NgModule({
  declarations: [
    AppComponent,
    PageNotFoundComponent,
    HomeComponent,
    HeaderComponent,
    OverviewComponent,
    InstancesTabComponent,
    InstancesTableComponent,
    InstanceDetailsComponent,
    CosListComponent,
    PipelineDefinitionComponent,
    ChangePasswordComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    ReactiveFormsModule,
    AuthModule,
    AppRoutingModule,
    ClarityModule,
    NgxJsonViewerModule
  ],
  providers: [ ],
  bootstrap: [AppComponent]
})
export class AppModule { }
