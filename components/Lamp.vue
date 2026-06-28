<script setup lang="ts">
const list = ref()
const playList = ref()
async function getPlayList() {
 const resp =  await $fetch('https://pet-server-tau.vercel.app/api/lamp/get-list')
  list.value = resp.results
}
async function getVideoUrls() {
  const resp =  await $fetch('https://pet-server-tau.vercel.app/api/lamp/play-list', { //
    params: {
      id: list.value[0].id,
      pageUrl: list.value[0].url
    }
  })
  playList.value = resp.results
}
</script>

<template>
  <div>
    <button @click="getPlayList">get palylist</button>
    <button v-if="list" @click="getVideoUrls">get video urls</button>
  </div>

</template>

<style scoped>

</style>