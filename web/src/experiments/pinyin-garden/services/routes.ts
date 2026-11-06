export type Page='slots'|'home'|'battle'|'collection'|'settings';
export interface GardenRoute {page:Page;slot:number;level?:number;levelId?:string;review?:boolean}
export function parseRoute(hash:string):GardenRoute {
 const match=/^#\/garden\/([1-3])\/(home|collection|settings|review|battle\/(?:[1-9]|1[0-4]|[a-z][a-z0-9-]{0,79}))$/.exec(hash);
 if(!match)return {page:'slots',slot:0};
 const path=match[2];return {slot:Number(match[1])-1,page:path==='review'||path.startsWith('battle/')?'battle':path as Page,level:path.startsWith('battle/')&&/^\d+$/.test(path.split('/')[1])?Number(path.split('/')[1]):undefined,levelId:path.startsWith('battle/')&&!/^\d+$/.test(path.split('/')[1])?path.split('/')[1]:undefined,review:path==='review'};
}
export function routeHash(route:GardenRoute):string {return route.page==='slots'?'#/gardens':`#/garden/${route.slot+1}/${route.page==='battle'?(route.review?'review':`battle/${route.levelId??route.level??1}`):route.page}`;}
