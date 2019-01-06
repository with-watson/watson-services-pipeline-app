import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { PipelineService } from '../shared/pipeline.service';

@Component({
  selector: 'app-instance-details',
  templateUrl: './instance-details.component.html',
  styleUrls: ['./instance-details.component.scss']
})
export class InstanceDetailsComponent implements OnInit {

  id: string
  instanceDetails = {}

  constructor(private router: Router, private route: ActivatedRoute, private pipelineSvc: PipelineService) { }

  ngOnInit() {
    this.route.params.subscribe(params => {
      // Add the file extention back to form the id again.
      this.id = params['id']
      this.loadInstanceDetails()
    })
  }

  loadInstanceDetails() {
    this.pipelineSvc.findById(this.id).subscribe(resp => {
      this.instanceDetails = resp
    })
  }

  onBackToOverview() {
    this.router.navigate(['/', 'home', 'overview'])
  }

}
