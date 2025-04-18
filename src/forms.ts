import { formType } from './types';

// Standard form message template that dumps all content. Used for debugging,
// - do not remove, add your own specialised ones.

const stdTemplate = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"
  "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<html>
<head>
  <meta charset="utf-8">
  <title>Form Submission Details</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
    }
    h3 {
      color: #444;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #f5f5f5;
    }
  </style>
</head>
<body>
  <h3>Form Fields</h3>
  {% if formFields %}
    <table>
      <thead>
        <tr>
          <th>Field</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        {% for field, value in formFields %}
          <tr>
            <td>{{ field }}</td>
            <td>{{ value }}</td>
          </tr>
        {% endfor %}
      </tbody>
    </table>
  {% else %}
    <p>No form fields submitted.</p>
  {% endif %}

  <h3>File Metadata</h3>
  {% if files and files.length %}
    <table>
      <thead>
        <tr>
          <th>Filename</th>
          <th>Path</th>
        </tr>
      </thead>
      <tbody>
        {% for file in files %}
          <tr>
            <td>{{ file.originalname }}</td>
            <td>{{ file.path }}</td>
          </tr>
        {% endfor %}
      </tbody>
    </table>
  {% else %}
    <p>No files attached.</p>
  {% endif %}
</body>
</html>
`;

export const forms: Record<string, formType> = {
	atleform: {
		rcpt: 'atle@document.no',
		sender: 'Mother of All Forms <noreply@m.document.no>',
		subject: 'A New Form Has Been Gifted You',
		template: stdTemplate,
	},
	bjornform: {
		rcpt: 'bjornjac@pm.me',
		sender: 'Mother of All Forms <noreply@m.document.no>',
		subject: 'A New Form Has Been Gifted You',
		template: stdTemplate,
	},
};
