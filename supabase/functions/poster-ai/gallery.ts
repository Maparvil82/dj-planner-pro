import {PosterError} from './domain.ts';

export const GALLERY_PAGE_SIZE=30;
export function galleryCursor(value:unknown):{createdAt:string;id:string}|null{
  if(value==null)return null;
  const cursor=value as Record<string,unknown>;
  if(typeof cursor.createdAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.test(cursor.createdAt)||!Number.isFinite(Date.parse(cursor.createdAt))||typeof cursor.id!=='string'||! /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(cursor.id))throw new PosterError('poster_invalid_input');
  return {createdAt:cursor.createdAt,id:cursor.id};
}
export function galleryQuery(query:any,cursor:ReturnType<typeof galleryCursor>){
  if(cursor)query=query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
  return query.order('created_at',{ascending:false}).order('id',{ascending:false}).limit(GALLERY_PAGE_SIZE+1);
}
export function galleryPage(rows:Record<string,any>[]){
  const jobs=rows.slice(0,GALLERY_PAGE_SIZE);
  const last=jobs.at(-1);
  return {jobs,nextCursor:rows.length>GALLERY_PAGE_SIZE&&last?{createdAt:last.created_at,id:last.id}:null};
}
