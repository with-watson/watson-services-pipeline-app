import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { ClrDatagridStateInterface } from '@clr/angular';
import { PipelineService } from '../shared/pipeline.service';
import { Router, ActivatedRoute } from '@angular/router';

import * as Moment from 'moment'
import { Observable, Subscription } from 'rxjs';

@Component({
  selector: 'app-instances-table',
  templateUrl: './instances-table.component.html',
  styleUrls: ['./instances-table.component.scss']
})
export class InstancesTableComponent implements OnInit {

  public pipelineInstances: Array<any> = []

  @Input() type:string

  public clrDgPage = 1
  public totalRows = 0
  public loading: boolean = true
  private limit = 8

  private dataChangedSub:Subscription = undefined
  
  constructor(private pipelineSvc: PipelineService,  private router: Router, private route: ActivatedRoute) { }

  ngOnInit() {
    this.dataChangedSub = this.pipelineSvc.onReloadStateData().subscribe(() => {
      this.refresh({
        page: {
          from: 0
        }
      })
    })
  }

  ngOnDestroy() {
    console.log('Destroying Table with ' + this.type + ' data.')
    this.dataChangedSub.unsubscribe()
  }

  refresh(state: ClrDatagridStateInterface) {
    if (!state.page) return   
    this.pipelineInstances = []

    let endDt = Moment().add(1, 'days').format('MM-DD-YYYY')
    let startDt = Moment().subtract(1, 'years').format('MM-DD-YYYY')

    // Reload the results from the database
    this.pipelineSvc.getInstances(this.type, startDt, endDt, state.page.from, this.limit).subscribe(resp => {
      resp.rows.forEach(row => this.pipelineInstances.push(row))
      this.totalRows = resp.total_rows
      this.loading = false
    })
  }

  onViewInstance(id:string) {
    this.router.navigate(['../instance-details', id], { relativeTo: this.route })
  }

  onDestroyInstance(id:string) {
    this.pipelineSvc.destroyById(id).subscribe(resp => {
      this.refresh({
        page: {
          from: 0
        }
      })
    })
  }
}
