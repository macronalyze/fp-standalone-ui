import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

declare const google: any;

export interface User {
  email: string;
  name: string;
  picture: string | null;
  role: 'admin' | 'user';
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private tokenKey = 'fp_token';
  private userKey = 'fp_user';

  private userSubject = new BehaviorSubject<User | null>(this.loadUser());
  user$ = this.userSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
    private ngZone: NgZone,
  ) {}

  get token(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  get user(): User | null {
    return this.userSubject.value;
  }

  get isLoggedIn(): boolean {
    return !!this.token;
  }

  get isAdmin(): boolean {
    return this.user?.role === 'admin';
  }

  initGoogleSignIn(buttonElement: HTMLElement): void {
    google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: (response: any) => this.handleCredentialResponse(response),
    });
    google.accounts.id.renderButton(buttonElement, {
      theme: 'outline',
      size: 'large',
      type: 'standard',
    });
  }

  private handleCredentialResponse(response: any): void {
    this.ngZone.run(() => {
      this.http
        .post<{ access_token: string; user: User }>(
          `${environment.apiUrl}/auth/google`,
          { token: response.credential },
        )
        .subscribe({
          next: (res) => {
            localStorage.setItem(this.tokenKey, res.access_token);
            localStorage.setItem(this.userKey, JSON.stringify(res.user));
            this.userSubject.next(res.user);
            this.router.navigate(['/countries']);
          },
          error: (err) => {
            console.error('Login failed', err);
          },
        });
    });
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.userSubject.next(null);
    google.accounts.id.disableAutoSelect();
    this.router.navigate(['/login']);
  }

  private loadUser(): User | null {
    const data = localStorage.getItem(this.userKey);
    return data ? JSON.parse(data) : null;
  }
}
