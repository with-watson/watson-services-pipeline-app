import { Component, OnInit, ViewChild } from '@angular/core';
import { LoopbackAuthService } from '../loopback/loopback-auth.service';
import { ClrDatagridStateInterface, ClrModal } from '@clr/angular';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { timer } from 'rxjs';
import { refreshDescendantViews } from '@angular/core/src/render3/instructions';

@Component({
  selector: 'app-user-management',
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.scss']
})
export class UserManagementComponent implements OnInit {

  @ViewChild("addUserModal") addUserModal: ClrModal
  @ViewChild("editUserModal") editUserModal: ClrModal
  @ViewChild("deleteUserModal") deleteUserModal: ClrModal

  public alertMessage: string = ''
  public showAlert: boolean = false

  public addUserForm: FormGroup = this.createAddUserForm()
  public editUserForm: FormGroup = this.createEditUserForm({
    id: 0,
    username: '',
    email: ''
  })

  private selectedUser:any

  public clrDgPage = 1
  public totalRows = 0
  public loading: boolean = true
  private limit = 8

  public users: Array<any> = []

  constructor(private authService: LoopbackAuthService) { }

  ngOnInit() {
  }

  refresh(state: ClrDatagridStateInterface) {
    if (!state.page) return
    this.users = []

    // Reload the results from the database
    this.authService.httpGet('api/ApiUsers').subscribe(resp => {
      this.users = resp
      this.totalRows = resp.length
      this.loading = false
    })
  }

  onAddUser() {
    this.addUserForm = this.createAddUserForm()
    this.addUserModal.open()
  }

  onEditUser(editedUser) {
    this.editUserForm = this.createEditUserForm(editedUser)
    this.editUserModal.open()
  }

  onDestroyUser(destroyableUser) {
    this.selectedUser = destroyableUser
    this.deleteUserModal.open()
  }

  submitDestroyUser() {
    this.authService.httpDelete('api/ApiUsers/' + this.selectedUser.id).subscribe(resp => {
      console.log(resp)
      this.selectedUser = undefined
      this.showAlertMessage('User was successfully removed from the system.')
      this.refresh({ page: { from: 0 }})
    })
  }

  createAddUserForm() {
    return new FormGroup({
      username: new FormControl('', [Validators.required]),
      email: new FormControl('', [Validators.required, Validators.pattern('^[a-z0-9]+(\.[_a-z0-9]+)*@[a-z0-9-]+(\.[a-z0-9-]+)*(\.[a-z]{2,15})$')]),
      password: new FormControl('', [Validators.required, Validators.minLength(8)]),
      password_confirmed: new FormControl('', [Validators.required, Validators.minLength(8), this.checkConfirmedPassword])
    })
  }

  createEditUserForm(editedUser) {
    return new FormGroup({
      id: new FormControl(editedUser.id),
      username: new FormControl(editedUser.username, [Validators.required]),
      email: new FormControl(editedUser.email, [Validators.required, Validators.pattern('^[a-z0-9]+(\.[_a-z0-9]+)*@[a-z0-9-]+(\.[a-z0-9-]+)*(\.[a-z]{2,15})$')])
    })
  }

  submitAddUserForm(newUserValues) {
    newUserValues.emailVerified = true
    delete newUserValues.password_confirmed

    this.authService.httpPostRaw('/api/ApiUsers', newUserValues).subscribe(resp => {
      console.log(resp)
      this.showAlertMessage('User successfully added.')
      this.refresh({ page: { from: 0 }})
    })
  }

  submitEditUserForm(editUserValues) {
    editUserValues.emailVerified = true
    this.authService.httpPatchRaw('/api/ApiUsers/' + editUserValues.id, editUserValues).subscribe(resp => {
      console.log(resp)
      this.showAlertMessage('User successfully modified.')
      this.refresh({ page: { from: 0 }})
    })
  }

  showAlertMessage(msg:string) {
    this.showAlert = true
    this.alertMessage = msg
    timer(5000).subscribe(() => {
      this.showAlert = false
    })
  }

  checkConfirmedPassword(confirmedPasswordControl: FormControl) {
    if (!confirmedPasswordControl.root || !confirmedPasswordControl.root.value.password) {
      return null;
    }
    const exactMatch = confirmedPasswordControl.root.value.password === confirmedPasswordControl.value;
    return exactMatch ? null : { mismatchedPassword: true };
  }
}
