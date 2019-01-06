import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { PipelineService } from '../shared/pipeline.service';
import { ClrDatagridStringFilterInterface } from '@clr/angular';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-cos-list',
  templateUrl: './cos-list.component.html',
  styleUrls: ['./cos-list.component.scss']
})
export class CosListComponent implements OnInit {

  _pipelineName:string
  
  availableCosFiles: Array<string> = []
  
  clrDgPage = 1
  totalRows = 0
  limit = 5

  fileNameFilter = new FileNameFilter()

  @Input() renderGrid: boolean = false

  @Input() set pipelineName (val:string) {
    if (val && val.trim().length > 0 && val != this._pipelineName) {
      this._pipelineName = val
      this.pipelineSvc.getFilesReadyToProcess(val).subscribe(filesResp => {
        this.availableCosFiles = filesResp
        this.totalRows = filesResp.length
      })  
    }
  }

  @Input() selectedCosFile: string

  @Output() onSelectedFileChange:EventEmitter<string> = new EventEmitter()

  constructor(private pipelineSvc: PipelineService) { }

  ngOnInit() {
    this.pipelineSvc.onTriggerOverviewDataReload().subscribe(() => {
      console.log('CosListComponent: Overview data has changed.')
    })
  }

  selectedFileChanged(evt) {
    if (evt) {
      this.onSelectedFileChange.emit(evt)
    }
  }
}

class FileNameFilter implements ClrDatagridStringFilterInterface<string> {
  changes = new Subject<any>();
  isActive(): boolean { return true }
  accepts(fileName: string, search: string) { 
    return "" + fileName == search
            || fileName.toLowerCase().indexOf(search) >= 0
  }
}
