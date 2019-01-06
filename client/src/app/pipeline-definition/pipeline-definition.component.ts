import { Component, OnInit } from '@angular/core';
import { PipelineService } from '../shared/pipeline.service';

@Component({
  selector: 'app-pipeline-definition',
  templateUrl: './pipeline-definition.component.html',
  styleUrls: ['./pipeline-definition.component.scss']
})
export class PipelineDefinitionComponent implements OnInit {

  constructor(private pipelineSvc: PipelineService) { }

  pipelineDefRows = []
  pipelineDefinitions:any


  ngOnInit() {
    let row = 0
    let col = 0
    let maxCols = 3
    this.pipelineDefRows.push([])
    this.pipelineSvc.getPipelineDefinitions().subscribe(pipelineDefinitions => {
      for (let pipelineName in pipelineDefinitions) {
        this.pipelineDefRows[row].push(pipelineDefinitions[pipelineName])
        col++
        if (col >= maxCols) {
          col = 0
          row++
          this.pipelineDefRows.push([])
        }
      }
    })
  }

}
