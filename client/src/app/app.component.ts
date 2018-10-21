import { Component } from '@angular/core';
import { Title } from '@angular/platform-browser'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent {

  constructor(private TitleSvc:Title) {
    this. TitleSvc.setTitle('wsl-lb3-ng5-bs4-starter');
  }
}
