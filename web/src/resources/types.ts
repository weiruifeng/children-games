export interface Resource {id:string;url:string;sha256:string;bytes:number;mime:string;type:'image'|'audio';width?:number;height?:number;decodedBytes?:number}
export interface Catalog {schemaVersion:number;releaseId:string;appBuildId:string;contentVersion:string;resources:Record<string,Resource>;groups:Record<string,string[]>;budgets:Record<string,{bytes:number;decodedBytes:number}>}
export type Progress={completed:number;total:number;phase:'loading'|'preparing-scene'|'ready'|'failed';error?:string};
export interface Diagnostic {at:string;phase:string;resource?:string;source?:string;ms?:number;error?:string}
