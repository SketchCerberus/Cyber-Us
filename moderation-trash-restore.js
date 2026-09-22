/* Restore artwork from a private copy, preserving database and Storage consistency. */
(() => {
  'use strict';
  window.CyberUsTrashRestore=async(db,id,reason)=>{
    const record=await db.from('fanart_submissions')
      .select('id,extension,image_path,status,trash_bucket,trash_path,trash_previous_status')
      .eq('id',id).maybeSingle();
    if(record.error||!record.data||record.data.status!=='rejected')return {error:record.error||new Error('Artwork unavailable')};
    const work=record.data;
    if(work.trash_previous_status!=='approved')
      return db.rpc('restore_trash_fanart',{p_id:id,p_reason:reason});
    if(work.trash_bucket!=='fanart-trash'||work.trash_path!==`${id}.${work.extension}`)
      return {error:new Error('Private copy unavailable')};
    const publicPath=`${id}.${work.extension}`;
    const cleanup=await db.storage.from('fanart-public').remove([publicPath]);
    if(cleanup.error)return {error:cleanup.error};
    const copy=await db.storage.from('fanart-trash').copy(work.trash_path,publicPath,{destinationBucket:'fanart-public'});
    if(copy.error)return {error:copy.error};
    const restored=await db.rpc('restore_trash_fanart',{p_id:id,p_reason:reason});
    if(restored.error||restored.data!==true){
      await db.storage.from('fanart-public').remove([publicPath]);
      return restored;
    }
    // If deletion fails, the daily Storage cleanup handles the orphaned private copy.
    await db.storage.from('fanart-trash').remove([work.trash_path]);
    return restored;
  };
})();
