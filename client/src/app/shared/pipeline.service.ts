import { Injectable } from '@angular/core';
import { LoopbackAuthService } from '../auth/loopback/loopback-auth.service';
import { map } from 'rxjs/operators';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PipelineService {

  previousOverviewResp: any = undefined

  reloadStateDataSub:Subject<boolean> = new Subject()
  triggerOverviewDataReloadSub:Subject<boolean> = new Subject()

  checkOverviewChange = map((value:any) => {
    // Check if the data has changed...
    if (this.previousOverviewResp != value) {
      if (this.previousOverviewResp != undefined) {
        // If the previous overview and the retrieved overview isn't the same
        if (JSON.stringify(this.previousOverviewResp) != JSON.stringify(value)) {
          
          // Reload the current instance table as well
          this.reloadStateDataSub.next(true)
        }
      }
      this.previousOverviewResp = value
    }
    return value
  })

  constructor(private authService: LoopbackAuthService) { 
  }

  public onTriggerOverviewDataReload() {
    return this.triggerOverviewDataReloadSub
  }

  public triggerOverviewDataReload() {
    this.triggerOverviewDataReloadSub.next(true)
  }

  public onReloadStateData() {
    return this.reloadStateDataSub
  }

  public findById(id:string) {
    let qp = [
      {
        name: 'id',
        value: id
      }
    ]
    return this.authService.httpGet('api/PipelineManagement/findById', qp)
  }

  public destroyById(id:string) {
    let qp = [
      {
        name: 'id',
        value: id
      }
    ]
    return this.authService.httpDelete('api/PipelineManagement/destroyById', qp)
  }

  public getRuntimeOverview(byPeriod?) {
    let qp = []
    if (byPeriod) {
      qp = [
        {
          name: 'byPeriod',
          value: byPeriod
        }
      ]
    }
    return this.authService.httpGet('api/PipelineManagement/getPipelineStateSummary', qp).pipe(this.checkOverviewChange)
  }

  public getInstances(state:string, startDt:string, endDt:string, skip:number, limit:number) {

    let qp = [
      {
        name: 'state',
        value: state
      },
      {
        name: 'startDt',
        value: startDt
      },
      {
        name: 'endDt',
        value: endDt
      },
      {
        name: 'skip',
        value: skip
      },
      {
        name: 'limit',
        value: limit
      }
    ]
    return this.authService.httpGet('api/PipelineManagement/getByPipelineState', qp)
  }

  public getPipelineDefinitions() {
    return this.authService.httpGet('api/Pipeline/getPipelineDefinitions')
  }

  public simpleTrigger(triggerData:any) {
    return this.authService.httpPostRaw('api/Pipeline/simpleTrigger', triggerData)
  }

  public postUploadTrigger(triggerData:any) {
    return this.authService.httpPostRaw('api/Pipeline/postUploadTrigger', triggerData)
  }

  public uploadTrigger(formData: FormData) {
    return this.authService.httpPostFormData('api/Pipeline/uploadTrigger', formData)
  }

  public getFilesReadyToProcess(pipelineName:string) {
    let qp = [
      {
        name: 'pipelineName',
        value: pipelineName
      }
    ]
    return this.authService.httpGet('api/PipelineManagement/getFilesReadyToProcess', qp)
  }
}
