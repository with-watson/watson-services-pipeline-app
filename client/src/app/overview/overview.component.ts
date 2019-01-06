import { Component, OnInit } from '@angular/core';
import { PipelineService } from '../shared/pipeline.service';
import { timer, Subscription } from 'rxjs';

@Component({
  selector: 'app-overview',
  templateUrl: './overview.component.html',
  styleUrls: ['./overview.component.scss']
})
export class OverviewComponent implements OnInit {

  reloadTimerSub:Subscription
  triggerOverviewDataReloadSub:Subscription

  public summary = {
    'active': 0,
    'failed': 0,
    'completed': 0
  }

  constructor(private pipelineSvc: PipelineService) { 
  }

  ngOnInit() {
    // When the overview data changes, other components will trigger this subscription.
    this.reloadTimerSub = timer(1000, 10000).subscribe(() => {
      this.loadData()
    })
    this.triggerOverviewDataReloadSub = this.pipelineSvc.onTriggerOverviewDataReload().subscribe(() => {
      this.loadData()
    })
  }

  ngOnDestroy() {
    console.log('Cleaning up overview component...')
    this.reloadTimerSub.unsubscribe()
    this.triggerOverviewDataReloadSub.unsubscribe()
  }

  loadData() {
    this.pipelineSvc.getRuntimeOverview().subscribe(resp => {
      this.summary.active = resp.active
      this.summary.failed = resp.failed
      this.summary.completed = resp.completed
    })
  }
}
