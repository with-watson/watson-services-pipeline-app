import { Component, OnInit, EventEmitter, Output, Input } from '@angular/core';
import { LoopbackAuthService } from '../auth/loopback/loopback-auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {

  @Output() onNewTrigger: EventEmitter<boolean> = new EventEmitter()

  @Input() activeUserInfo:any

  public showChangePassword:boolean = false

  constructor(private authService:LoopbackAuthService, private router: Router) { }

  ngOnInit() {
  }

  onNewTriggerClick() {
    this.onNewTrigger.emit(true)
  }

  onPipelineDefinition() {
    this.router.navigate(['home', 'pipeline-definition'])  
  }

  logout() {
    this.authService.logout().subscribe(() => {
      console.log('Logged out.')
    })
  }

  changePassword() {
    this.showChangePassword = true  
  }
}
