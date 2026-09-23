import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly messages = signal<{ id: number; kind: 'success' | 'error'; message: string }[]>([]);
  private sequence = 0;

  success(message: string) { this.show('success', message); }
  error(message: string) { this.show('error', message); }
  dismiss(id: number) { this.messages.update(messages => messages.filter(message => message.id !== id)); }

  private show(kind: 'success' | 'error', message: string) {
    const id = ++this.sequence;
    this.messages.update(messages => [...messages.slice(-2), { id, kind, message }]);
    setTimeout(() => this.dismiss(id), 3000);
  }
}
