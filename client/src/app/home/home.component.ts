import { Component, OnInit, ViewChild } from '@angular/core';

import { ClrWizard } from "@clr/angular";
import { PipelineService } from '../shared/pipeline.service';
import { timer } from 'rxjs';
import { LoopbackAuthService } from '../auth/loopback/loopback-auth.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  @ViewChild("triggerWiz") triggerWiz: ClrWizard

  triggerWizOpen: boolean = false;

  selectedTriggerType: string = 'simple'
  selectedPipelineDef: string
  refData: any = {}
  selectedCosFile: string

  refDataStr: string = ''
  availablePipelineDefs: Array<any> = []
  availableCosFiles: Array<string> = []

  renderCosListGrid: boolean = false

  selectedUploadFile:any

  activeUserInfo: any = {
    email: "Loading...",
    roles: []
  }

  constructor(private authService:LoopbackAuthService, private pipelineSvc: PipelineService) { }

  ngOnInit() {
    this.authService.getActiveUserInfo().subscribe((res) => {
      this.activeUserInfo = res
    })
  }

  showTriggerWiz() {
    if (this.availablePipelineDefs.length === 0) {
      this.pipelineSvc.getPipelineDefinitions().subscribe(pipelineDefs => {
        for (let pipelineName in pipelineDefs) {
          this.availablePipelineDefs.push(pipelineName)
        }
        this.selectedPipelineDef = this.availablePipelineDefs[0]

        this.triggerWizOpen = true
      })
    } else {
      this.triggerWizOpen = true
    }
  }

  validateTriggerData() {
    if (this.refDataStr.trim().length === 0) return false
    try {
      this.refDataStr = JSON.stringify(JSON.parse(this.refDataStr))
      this.refData = JSON.parse(this.refDataStr)
      return false
    } catch (err) {
      return true
    }
  }

  onTriggerWizFinished() {
    let triggerReq:any = {
      pipelineName: this.selectedPipelineDef,
      referenceData: this.refData
    }
    if (this.selectedTriggerType === 'simple') {
      this.pipelineSvc.simpleTrigger(triggerReq).subscribe(act => {
        this.resetWizValues()
        timer(2000).subscribe(() => {
          this.pipelineSvc.triggerOverviewDataReload()
        })
      })
    }
    if (this.selectedTriggerType === 'postupload') {
      triggerReq.fileName = this.selectedCosFile
      this.pipelineSvc.postUploadTrigger(triggerReq).subscribe(act => {
        this.resetWizValues()
      })
    }
    if (this.selectedTriggerType === 'upload') {
      if (this.selectedUploadFile) {
        let fd:FormData = new FormData()
        fd.append('pipelineName', this.selectedPipelineDef)
        fd.append('file', this.selectedUploadFile)
        this.pipelineSvc.uploadTrigger(fd).subscribe(act => {
          console.log(act)
          this.resetWizValues()
        })
      }
    }
  }

  onTriggerWizCancel() {
    this.resetWizValues()
  }

  selectedCosFileChanged(fileName:string) {
    this.selectedCosFile = fileName
  }

  onSelectedUploadFileChange(evt) {
    this.selectedUploadFile = evt.target.files[0]
  }

  onCosListWizPageLoad() {
    this.renderCosListGrid = true
  }

  resetWizValues() {
    this.availableCosFiles = []
    this.selectedTriggerType = undefined
    this.selectedCosFile = undefined
    this.renderCosListGrid = false
    this.selectedUploadFile = undefined
    this.triggerWiz.reset()
  }
}
