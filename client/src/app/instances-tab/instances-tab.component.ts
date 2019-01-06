import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { PipelineService } from '../shared/pipeline.service';

import { Subject } from 'rxjs';

@Component({
  selector: 'app-instances-tab',
  templateUrl: './instances-tab.component.html',
  styleUrls: ['./instances-tab.component.scss']
})
export class InstancesTabComponent implements OnInit {

  public completedDataSub: Subject<any> = new Subject()

  selectedType = 'completed'

  constructor(private pipelineSvc: PipelineService) { }

  ngOnInit() {
  }

  onTypeChange(type) {
    this.selectedType = type
  }

}
