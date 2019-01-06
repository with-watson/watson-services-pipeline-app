
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders, HttpParams, HttpErrorResponse } from '@angular/common/http';

import { throwError as observableThrowError,  Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { of } from 'rxjs'

@Injectable()
export class LoopbackAuthService {

  // private instance variable to hold base url
  private loginUrl = '/api/ApiUsers/login';
  private logoutUrl = '/api/ApiUsers/logout';
  private findByIdUrl = '/api/ApiUsers';
  // key used for saving the token in session storage
  private TOKEN_KEY = 'api-user-token';
  private USER_ID_KEY = 'api-user-id';

  private activeUserId: string = undefined;
  private activeUserInfo: any = undefined;

  // Resolve HTTP using the constructor
  constructor(private http: HttpClient, private router: Router) { }

  // Function that will indicate if a user is logged in or not.
  public isAuthenticated(): Observable<boolean> {
    let cachedToken = this.getLoopbackToken();
    
    if (cachedToken && cachedToken.token && cachedToken.id) {

      this.activeUserId = cachedToken.id

      let validateTokenUrl = this.findByIdUrl + '/' + cachedToken.id + '/accessTokens/' + cachedToken.token + '?access_token=' + cachedToken.token;

      return this.http.get(validateTokenUrl).pipe(

        map((res: any) => {
          // If we get a successful response here, we know the user is logged in.
          return true;
        }),

        catchError((error: HttpErrorResponse) => {
          // Otherwise we expect it didn't work and we route to the login screen
          this.deleteLookbackToken();
          this.router.navigate(['/login'])
          return of(false);
        }))
    } else {
      this.router.navigate(['/login'])
      return of(false);
    }
  }

  // Returns an Observable that will make the login request to the server and return the json containing the token
  public login(credentials: any): Observable<any> {
    return this.http.post(this.loginUrl, credentials).pipe(

      map((res: any) => {
        this.saveLoopbackToken(res);
        this.router.navigate(['/']);
        this.activeUserId = res.userId

        this.setActiveUserInfo().subscribe(() => {})

        return res;
      }),

      catchError((error: HttpErrorResponse) => {
        return observableThrowError(error || 'Server error');
      })
    )
  }

  // Returns an Observable that will make the logout request to the server with the token in session storage
  public logout(): Observable<string> {
    let cachedToken = this.getLoopbackToken();

    if (cachedToken && cachedToken.token) {

      let url = this.logoutUrl + '?access_token=' + cachedToken.token;

      return this.http.post(url, {}).pipe(

        map((res: any) => {
          this.activeUserId = undefined
          this.activeUserInfo = undefined

          this.deleteLookbackToken();
          this.router.navigate(['login']);
          return 'false';
        }),
        
        catchError((error: HttpErrorResponse) => observableThrowError(error))
      )
    }
  }

  public getActiveUserInfo(): Observable<any> {
    if (this.activeUserInfo) {
      return Observable.create((observer) => {
        observer.next(this.activeUserInfo)
      })
    } else {
      return this.setActiveUserInfo()
    }
  }

  public setActiveUserInfo(): Observable<any> {

    let cachedToken = this.getLoopbackToken();

    let url = this.findByIdUrl + '/' + this.activeUserId + '?access_token=' + cachedToken.token

    return this.http.get(url).pipe(map((res: any) => {
      this.activeUserInfo = res
      return res
    }))
  }

  // Remove the token from session storage.
  public deleteLookbackToken(): boolean {
    let stored = this.getLoopbackToken();
    if (stored) {
      sessionStorage.removeItem(this.TOKEN_KEY);
      sessionStorage.removeItem(this.USER_ID_KEY);
      return true;
    }
    return false;
  }

  // Make an Authenticated HTTP Get Request to the provided URL
  // Query Parameters should be in the form [{ 'name': 'abc', 'value': '123' }, ...]
  public httpGet(url, queryParams?): Observable<any> {

    let params = new HttpParams().set('access_token', this.getLoopbackToken().token)

    if (queryParams && queryParams.length > 0) {
      for (let qp of queryParams) {
        params = params.append(qp.name, qp.value.toString())
      }
    }
    
    return this.http.get(url, { params: params }).pipe(catchError(error => this.handleError(error)))
  }

  // Make an HTTP Post with FormData to the passed in URL
  // The formdata should be a FormData object and the response type can be the type of data expected back (default to json)
  public httpPostFormData(url, formData, responseType?): Observable<any> {
    
    let params = new HttpParams().set('access_token', this.getLoopbackToken().token)

    return this.http.post(url, formData, {
      params: params,
      responseType: responseType || 'json'
    }).pipe(catchError((error, caught) => {
      return this.handleError(error)
    }))
  }

  // Make an HTTP Post with URL Encoded request data to the passed in URL
  public httpPostUrlEncoded(url, queryParams?, responseType?): Observable<any> {
    
    let headers = new HttpHeaders().set('Content-Type', 'application/x-www-form-urlencoded')

    // Build the query string up from the params passed in.
    let params = new HttpParams().set('access_token', this.getLoopbackToken().token)

    if (queryParams && queryParams.length > 0) {
      for (let qp of queryParams) {
        params = params.append(qp.name, qp.value.toString())
      }
    }

    // Encode the url
    let encodedString = encodeURI(params.toString());

    return this.http.post(url, encodedString, {
      params: params,
      headers: headers,
      responseType: responseType || 'json'
    }).pipe(catchError((error, caught) => {
      return this.handleError(error)
    }))
      
  }

  // Make an HTTP Post with raw JSON data in the body of the request to the provided URL
  public httpPostRaw(url, data, contentType?): Observable<any> {

    let params = new HttpParams().set('access_token', this.getLoopbackToken().token);

    return this.http.post(url, data, { params: params }).pipe(catchError((error, caught) => {

      return this.handleError(error)

    }))
  }

  // Make an HTTP Post with raw JSON data in the body of the request to the provided URL
  public httpPatchRaw(url, data): Observable<any> {

    let params = new HttpParams().set('access_token', this.getLoopbackToken().token);

    return this.http.patch(url, data, { params: params }).pipe(catchError((error, caught) => {

      return this.handleError(error)

    }))
  }

  // Make an HTTP Delete request to the provided URL
  public httpDelete(url, queryParams?): Observable<any> {

    let params = new HttpParams().set('access_token', this.getLoopbackToken().token)

    if (queryParams && queryParams.length > 0) {
      for (let qp of queryParams) {
        params = params.append(qp.name, qp.value.toString())
      }
    }

    return this.http.delete(url, { params: params }).pipe(catchError((error, caught) => {
      return this.handleError(error)
    }))

  }

  // Retrieve the api token from the session storage and null if not found
  getLoopbackToken() {
    return {
      token: sessionStorage.getItem(this.TOKEN_KEY),
      id: sessionStorage.getItem(this.USER_ID_KEY)
    }
  }

  // Save the token returned from the login response in session storage
  saveLoopbackToken(credentials: any) {
    if (credentials && credentials.id) {
      sessionStorage.setItem(this.TOKEN_KEY, credentials.id);
      sessionStorage.setItem(this.USER_ID_KEY, credentials.userId);
    }
  }

  handleError(error: HttpErrorResponse) {

    if (error.status === 401) {
      this.deleteLookbackToken();
      return this.router.navigate(['login'])
    }
    // return an ErrorObservable with a user-facing error message
    let errorFound = this.findErrorMessage(error)
    return throwError(errorFound)
  }

  findErrorMessage(error) {
    if (error.error) {
      return this.findErrorMessage(error.error)
    }
    if (error.message) {
      return error.message
    }
    return error
  }
}
