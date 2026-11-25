-- Split the existing two disjoint areas without deleting the original district.
-- The western area retains its id; metadata and visibility are copied east.
do $$
declare source public.map_districts%rowtype;
begin
 select * into source from public.map_districts where id='honeycombs' for update;
 if not found then raise exception 'Honeycombs district is missing'; end if;
 if jsonb_array_length(source.polygons)=1 and exists(select 1 from public.map_districts where id='honeycombs-east') then return; end if;
 if jsonb_array_length(source.polygons)<>2 then raise exception 'Expected two Honeycombs contours'; end if;
 if exists(select 1 from public.map_districts where id='honeycombs-east') then raise exception 'Eastern district already exists'; end if;
 insert into public.map_districts(id,name,short_description,description,color,polygons,image,security,control,activity,visibility,contour_status)
 values('honeycombs-east','Восточные Соты',source.short_description,source.description,source.color,jsonb_build_array(source.polygons->1),source.image,source.security,source.control,source.activity,source.visibility,source.contour_status);
 update public.map_districts set name='Западные Соты',polygons=jsonb_build_array(source.polygons->0),revision=revision+1 where id=source.id;
 -- The original components lie on opposite sides of x=.5 in normalized coordinates.
 update public.map_locations set district_id='honeycombs-east',revision=revision+1 where district_id=source.id and (position->>'x')::numeric>.5;
end $$;
