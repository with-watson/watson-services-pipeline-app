import { Component, OnInit } from '@angular/core';
import { LoopbackAuthService } from '../loopback/loopback-auth.service';

import { merge, of, timer } from 'rxjs';
import { catchError, map } from 'rxjs/operators'

import * as moment from 'moment';

@Component({
  selector: 'app-http-test',
  templateUrl: './http-test.component.html',
  styleUrls: ['./http-test.component.scss']
})
export class HttpTestComponent implements OnInit {

  public results = []

  constructor(private authService: LoopbackAuthService) { }

  ngOnInit() {
  }

  ngAfterViewInit() {
    this.executeTest()
  }

  public executeTest() {

    this.results = []
  
    timer(500).subscribe(() => {
      let httpGet = this.authService.httpGet('api/TestApi/get', this.getQueryParams('GET')).pipe(map(r => this.handleSuccess('GET', r)), catchError(e => this.handleError('GET', e)))
      let httpPostFormData = this.authService.httpPostFormData('api/TestApi/postFormData', this.getFormData()).pipe(map(r => this.handleSuccess('POST (FormData)', r)), catchError(e => this.handleError('POST (FormData)', e)))
      let httpPostRaw = this.authService.httpPostRaw('api/TestApi/postRaw', this.getRawJson()).pipe(map(r => this.handleSuccess('POST (Raw)', r)), catchError(e => this.handleError('POST (Raw)', e)))
      let httpPostUrlEncoded = this.authService.httpPostUrlEncoded('api/TestApi/postUrlEncoded', this.getQueryParams('POST (Url Encoded)')).pipe(map(r => this.handleSuccess('POST (Url Encoded)', r)), catchError(e => this.handleError('POST (Url Encoded)', e)))
      let httpDelete = this.authService.httpDelete('/api/TestApi/delete', this.getQueryParams('DELETE')).pipe(map(r => this.handleSuccess('DELETE', r)), catchError(e => this.handleError('DELETE', e)))
    
      merge(httpGet, httpPostFormData, httpPostRaw, httpPostUrlEncoded, httpDelete).subscribe(r => {
        this.results.push(r)
      })
    })

  }

  private handleError(callType, err) {
    return of({ 'callType': callType, 'outcome': err })
  }

  private handleSuccess(callType, results) {
    let respTime = moment().valueOf() - Number.parseInt(results.sentAtClient)
    return { 'callType': callType, 'outcome': 'Success!', 'respTime': respTime }
  }

  private getFormData() {
    let formData = new FormData()
    formData.append("sentAtClient", moment().valueOf().toString())
    formData.append("callType", "POST (FormData)")
    formData.append('valueOne', 'one')
    formData.append('valueTwo', 'two')
    return formData
  }

  private getRawJson() {
    return {
      "sentAtClient": moment().valueOf(),
      "callType": "POST (Raw)",
      "valueOne": "one",
      "valueTwo": "two"
    }
  }

  private getQueryParams(callType) {
    return [
      {
        "name": "sentAtClient",
        "value": moment().valueOf()
      },
      {
        "name": "callType",
        "value": callType
      },
      { 
        "name": "valueOne",
        "value": "one"
      },
      { 
        "name": "valueTwo",
        "value": "two"
      }
    ]
  }

}
