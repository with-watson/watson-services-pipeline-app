import { Component, OnInit, Input, ViewChild } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { ClrModal } from '@clr/angular';
import { LoopbackAuthService } from '../loopback/loopback-auth.service';

@Component({
  selector: 'app-change-password',
  templateUrl: './change-password.component.html',
  styleUrls: ['./change-password.component.scss']
})
export class ChangePasswordComponent implements OnInit {

  @Input() set showChangePassword (value:boolean) {
    if (value) {
      this.authService.getActiveUserInfo().subscribe((user) => {
        this.changePasswordForm = this.createPasswordChangeForm(user)
        this.changePasswordModal.open()
      })
    }
    else this.changePasswordModal.close()
  }

  @ViewChild("changePasswordModal") changePasswordModal: ClrModal
  
  public changePasswordForm: FormGroup = this.createPasswordChangeForm({
    id: 0
  })

  constructor(private authService: LoopbackAuthService) { }

  ngOnInit() {
  }

  createPasswordChangeForm(user) {
    return new FormGroup({
      id: new FormControl(user.id, [Validators.required]),
      oldPassword: new FormControl('', [Validators.required, Validators.minLength(8)]),
      newPassword: new FormControl('', [Validators.required, Validators.minLength(8)]),
      password_confirmed: new FormControl('', [Validators.required, Validators.minLength(8), this.checkConfirmedPassword]),
    })
  }

  submitPasswordChangeForm(values) {
    let qp = [
      {
        name: 'oldPassword',
        value: values.oldPassword
      },
      {
        name: 'newPassword',
        value: values.newPassword
      }
    ]
    this.authService.httpPostUrlEncoded('/api/ApiUsers/change-password', qp).subscribe(resp => {
      console.log(resp)
      if (!resp) {
        this.authService.logout().subscribe(_ => {})
      }
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
