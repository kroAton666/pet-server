<script setup lang="ts">
const list = ref()
const playList = ref()
async function getPlayList() {
 const resp =  await $fetch('/api/lamp/get-list', { ///api/lamp/play-list
    params: {
      url: "https://anitube.in.ua/3659-magchna-bitva-1-sezon.html"
    }
  })
  list.value = resp.results
}
async function getVideoUrls() {
  const resp =  await $fetch('/api/lamp/play-list', { //
    params: {
      id: list.value[0].id,
      pageUrl: list.value[0].url
    }
  })
  playList.value = resp.results
}
async function testRequest() {
  const resp =  await $fetch('https://polecreator.com/api/lamp/get-list', { //
    params: {
      url: "https://anitube.in.ua/3659-magchna-bitva-1-sezon.html"
    }
  })
}
</script>

<template>
  <div>
    <button @click="getPlayList">get palylist</button>
    <button v-if="list" @click="getVideoUrls">get video urls</button>
    <button @click="testRequest">get test request to pole</button>
  </div>

</template>

<style scoped>

</style>