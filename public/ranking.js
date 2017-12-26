Vue.component('voting', {
  template: `
  <div>
    <form class='voting' v-on:submit.prevent="submit">
      <input class='search' v-bind:class='{ invalid: isInvalid }' v-model='searchterm' v-on:keyup='search' type='text' placeholder="\uF002" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"/>
      <input class='submit' v-bind:disabled='isInvalid' type='submit' value='Vote \uf087'/>
    </form>
    <table class='results'>
      <tr v-for='result in results'>
        <td class='resultitem'>{{ result.votes }} x <i class='fa fa-thumbs-up'></i></td>
        <td class='resultitem'>{{ result.searches }} x <i class='fa fa-search'></i></td>
      </tr>
    </table>
    <hr>
    <h4 class='rankheading'>${city} Top 20</h4>
    <table class='ranking'>
      <tr v-for='result in ranking'>
        <td class='score'><i class='fa fa-recycle'></i> <a>{{ result.count }}</a></td>
        <td class='name' v-on:click="onclickName(result.name)">{{ result.name }}</td>
      </tr>
    </table>
    <hr>
    <h4 class='rankheading'>Global Top 10</h4>
    <table class='ranking'>
      <tr v-for='result in globalTop'>
        <td class='score'><i class='fa fa-recycle'></i> <a>{{ result.count }}</a></td>
        <td class='city' v-on:click="switchCity(result.city)"><a>{{ result.city }}</a></td>
        <td class='name' v-on:click="switchCity(result.city)">{{ result.name }}</td>
      </tr>
    </table>
  </div>
  `,
  data: function(){
    return{
      results: [],
      ranking: [],
      globalTop: [],
      searchterm: '',
      isInvalid: false
    }
  },
  methods: {
    switchCity: function(city){
      window.location.href = city
    },
    onclickName: function(name){
      this.searchterm = name
      this.search(null, true)
    },
    submit: function(){
      if(!this.searchterm.length)
        return

      var r = new XMLHttpRequest()
      r.open('POST', '/api/vote', true)
      r.setRequestHeader('Content-Type', 'application/json; charset=utf-8')
      r.onreadystatechange = function(){
        if (r.readyState != 4 || r.status != 200) return
      }
      r.send(`{
        "name": "${this.searchterm}",
        "city": "${city}"
      }`)
      localStorage.setItem(`${this.searchterm.toLowerCase()}${city.toLowerCase()}`, true)
      this.searchterm = ''
      this.results = []
      this.getTop()
    },
    search: function(e, click){
      var forbidden = [16,20,13,37,38,39,40]
      if(!click && forbidden.includes(e.keyCode)) return

      if(!this.searchterm.length){
        this.isInvalid = false
        this.results = []
        return
      }

      var regex = "^[A-Za-zäÄöÖüÜß ]+ [A-Za-zäÄöÖüÜß]{1}$"

      if(!this.searchterm.match(regex)){
        this.isInvalid = true
        this.results = []
        return
      }else if(localStorage.getItem(`${this.searchterm.toLowerCase()}${city.toLowerCase()}`)){
        this.isInvalid = true
      }else{
        this.isInvalid = false
      }

      var self = this

      var r = new XMLHttpRequest()
      r.open('POST', '/api/search', true)
      r.setRequestHeader('Content-Type', 'application/json; charset=utf-8')
      r.onreadystatechange = function(){
        if (r.readyState != 4 || r.status != 200) return
        self.results = [JSON.parse(r.responseText)]
      }
      r.send(`{
        "name": "${this.searchterm}",
        "city": "${city}"
      }`)
    },
    getTop: function(){
      var self = this
      var r = new XMLHttpRequest()
      r.open('GET', `/api/top/${city}`, true)
      r.setRequestHeader('Content-Type', 'application/json; charset=utf-8')
      r.onreadystatechange = function(){
        if (r.readyState != 4 || r.status != 200) return
        self.ranking = JSON.parse(r.responseText)
      }
      r.send()
    },
    getGlobalTop: function(){
      var self = this
      var r = new XMLHttpRequest()
      r.open('GET', `/api/global/top/`, true)
      r.setRequestHeader('Content-Type', 'application/json; charset=utf-8')
      r.onreadystatechange = function(){
        if (r.readyState != 4 || r.status != 200) return
        self.globalTop = JSON.parse(r.responseText)
      }
      r.send()
    }
  },
  mounted: function(){
    this.getTop() 
    this.getGlobalTop() 
    var self = this
    setInterval(function(){
      self.getTop() 
      self.getGlobalTop() 
    }, 5000)
  }
})

Vue.component('stats', {
  template: `
    <div>
      <div class='statsbody'>
        <a class='statsheader'>Live Stats</a><br>
        <a title='Users'><i class='fa fa-user-circle-o'></i><a class='number' v-bind:class='{ active: hActive}'> {{users}}</a></a>
        <a title='Votes'><i class='fa fa-thumbs-o-up'></i><a class='number' v-bind:class='{ active: pActive}'> {{votes}}</a></a>
        <a title='Searches'><i class='fa fa-search'></i><a class='number' v-bind:class='{ active: sActive}'> {{searches}}</a></a>
        <a title='Visitors'><i class='fa fa-eye'></i><a class='number' v-bind:class='{ active: vActive}'> {{visitors}}</a></a>
      </div>
    </div>
  `,
  data: function(){
    return{
      users: 0,
      votes: 0,
      searches: 0,
      visitors: 0,
      hActive: false,
      sActive: false,
      vActive: false,
      pActive: false,
    }
  },
  mounted: function(){
    var evtSource = new EventSource(`/api/events/${city}`)
    var self = this

    evtSource.addEventListener("votes", function(e) {
      self.votes = e.data
      self.pActive = true
      setTimeout(function(){
        self.pActive = false
      }, 700)
    }, false)

    evtSource.addEventListener("users", function(e) {
      if(e.data == self.users) return
      self.users = e.data
      self.hActive = true
      setTimeout(function(){
        self.hActive = false
      }, 700)
    }, false)

    evtSource.addEventListener("searches", function(e) {
      self.searches = e.data
      self.sActive = true
      setTimeout(function(){
        self.sActive = false
      }, 700)
    }, false)

    evtSource.addEventListener("visitors", function(e) {
      self.visitors = e.data
      self.vActive = true
      setTimeout(function(){
        self.vActive = false
      }, 700)
    }, false)
  }
})


var searchvm = new Vue({
  el: '#search'
})

var stats = new Vue({
  el: '#stats'
})

function timeSince(date) {
  if(!date)
    return 'noch nie'

  var date = new Date(date)
  var seconds = Math.floor((new Date() - date) / 1000);

  var interval = Math.floor(seconds / 31536000);

  if (interval > 1) {
    return `vor ${interval} Jahren` 
  }
  interval = Math.floor(seconds / 2592000);
  if (interval > 1) {
    return `vor ${interval} Monaten` 
  }
  interval = Math.floor(seconds / 86400);
  if (interval > 1) {
    return `vor ${interval} Tagen` 
  }
  interval = Math.floor(seconds / 3600);
  if (interval > 1) {
    return `vor ${interval} Stunden` 
  }
  interval = Math.floor(seconds / 60);
  if (interval > 1) {
    return `vor ${interval} Minuten` 
  }

  return `vor ${Math.floor(seconds)} Sekunden` 
}
