import webview

html = '''<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
    <div id="test">Testing...</div>
    <script type="module">
        console.log('ES modules work');
        document.getElementById('test').textContent = 'React will work!';
    </script>
</body>
</html>'''

webview.create_window('Test', html=html)
webview.start(debug=True)