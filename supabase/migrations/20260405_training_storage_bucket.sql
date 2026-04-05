-- Create training-content storage bucket (public so videos/docs are accessible)
INSERT INTO storage.buckets (id, name, public) VALUES ('training-content', 'training-content', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to read
CREATE POLICY "authenticated_read" ON storage.objects FOR SELECT USING (bucket_id = 'training-content' AND auth.role() = 'authenticated');

-- Allow authenticated users to upload/update/delete (admin check happens in app layer)
CREATE POLICY "admin_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'training-content' AND auth.role() = 'authenticated');
CREATE POLICY "admin_delete" ON storage.objects FOR DELETE USING (bucket_id = 'training-content' AND auth.role() = 'authenticated');
CREATE POLICY "admin_update" ON storage.objects FOR UPDATE USING (bucket_id = 'training-content' AND auth.role() = 'authenticated');
