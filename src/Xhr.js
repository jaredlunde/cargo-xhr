import Emitter from 'emitter-extended'
import {setDefinedOpt} from 'opt-setter'
import Cookies from 'js-cookie'
import Promise from 'cancelable-promise'

import Response from './Response'
import JsonResponse from './JsonResponse'
import TextResponse from './TextResponse'


const getRejection = (this_, reject, xhr) => e => reject(new Response(xhr, this_), e)

class Xhr extends Emitter {
  static READYSTATECHANGE = 'readystatechange'
  static START = 'start'
  static PROGRESS = 'progress'
  static SUCCESS = 'success'
  static TIMEOUT = 'timeout'
  static DONE = 'done'
  static ERROR = 'error'
  static ABORTED = 'aborted'

  constructor (opt) {
    super()
    this.timeout = null
    this.beforeSend = null
    this.responseType = 'json'  // Default response type
    this.responseTypes = {TEXT: 'text',
                          BUFFER: 'arraybuffer',
                          BLOB: 'blob',
                          HTML: 'document',
                          XML: 'document',
                          JSON: 'json'}
    this.withCsrf = true
    this.csrfCookieName = 'csrf'
    this.csrfHeaderName = 'x-csrf-token'
    this.csrfSafeMethods = ['get', 'options', 'head']
    this.withCredentials = true
    this.checkSupport = {cors: () => 'withCredentials' in new XMLHttpRequest()}

    this.register(...Object.keys(Xhr.XHR_EVENTS).map(x => Xhr.XHR_EVENTS[x]))
    setDefinedOpt(this, opt)
  }

  get (url, opt = {}) {
    opt.method = 'GET'
    return this.ship(url, opt)
  }

  post (url, opt = {}) {
    opt.method = 'POST'
    return this.ship(url, opt)
  }

  put (url, opt = {}) {
    opt.method = 'PUT'
    return this.ship(url, opt)
  }

  patch (url, opt = {}) {
    opt.method = 'PATCH'
    return this.ship(url, opt)
  }

  del (url, opt = {}) {
    opt.method = 'DELETE'
    return this.ship(url, opt)
  }

  options (url, opt = {}) {
    opt.method = 'OPTIONS'
    return this.ship(url, opt)
  }

  head (url, opt = {}) {
    opt.method = 'HEAD'
    return this.ship(url, opt)
  }


  ship (url, opt) {
    const xhr = new XMLHttpRequest()
    xhr.open(opt.method || 'GET', String(url))

    this._listen(xhr)
    this._setOptions(xhr, opt)
    this._setCsrfCredentials(xhr, opt)

    const responseType = opt.responseType || this.responseType
    const xhrResponseType = this.responseTypes[
      (responseType === 'json' ? 'text' : responseType).toUpperCase()]

    if (responseType)
      xhr.responseType = xhrResponseType

    if (this.beforeSend)
      this.beforeSend(this, xhr)

    return new Promise((resolve, reject) => {
      xhr.addEventListener('load', e => {
        let response = null
        resolve(this._wrapResponse(responseType, xhr))
      })

      xhr.addEventListener('timeout', getRejection(this, reject, xhr))
      xhr.addEventListener('aborted', getRejection(this, reject, xhr))
      xhr.addEventListener('error', getRejection(this, reject, xhr))

      xhr.send(opt.payload)
    })
  }

  _wrapResponse (responseType, xhr) {
    let response = null
    switch (responseType) {
      case 'json':
        response = new JsonResponse(xhr, this)
        break
      case 'text':
        response = new TextResponse(xhr, this)
        break
      default:
        response = new Response(xhr, this)
    }
    return response
  }

  _listen (xhr) {
    for (let evt in Xhr.XHR_EVENTS)
      xhr.addEventListener(evt, e => this.emit(Xhr.XHR_EVENTS[evt], e))
  }

  _setOptions (xhr, opt) {
    const withCredentials = opt.withCredentials !== void 0 ?
                            opt.withCredentials : this.withCredentials
    if (withCredentials) {
      xhr.withCredentials = true
    }

    const timeout = opt.timeout !== void 0 ? opt.timeout : this.timeout
    if (timeout) {
      xhr.timeout = timeout
    }

    if (opt.headers) {
      for (var name in opt.headers)
        xhr.setRequestHeader(name, opt.headers[name])
    }
  }

  _isCsrfMethod (method) {
    const csrfSafeMethods = []
    for (let safeMethod of this.csrfSafeMethods) {
      if (safeMethod.toUpperCase() === method.toUpperCase())
        return false
    }
    return true;
  }

  _setCsrfCredentials (xhr, opt) {
    const withCsrf = opt.withCsrf !== void 0 ? opt.withCsrf : this.withCsrf;
    if (!withCsrf || !this._isCsrfMethod(opt.method))
      return;

    var csrfCredentials = Cookies.get(this.csrfCookieName)
    if (csrfCredentials)
      xhr.setRequestHeader(this.csrfHeaderName, csrfCredentials)
  }
}


Xhr.XHR_EVENTS = {readystatechange: Xhr.READYSTATECHANGE,
                  loadstart: Xhr.START,
                  progress: Xhr.PROGRESS,
                  load: Xhr.SUCCESS,
                  timeout: Xhr.TIMEOUT,
                  loadend: Xhr.DONE,
                  error: Xhr.ERROR,
                  abort: Xhr.ABORTED}


export default Xhr
