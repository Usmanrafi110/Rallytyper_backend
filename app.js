require("dotenv").config();
const express = require("express");
const app = express();
const port = 3000;
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const multer = require("multer");
const { connection } = require("./lib/db");
const cloudinary = require("cloudinary").v2;
const upload = multer();
const apipath = process.env.API_PATH;

const allowedOrigins = [
  "https://rallytyper.netlify.app",
  "http://localhost:5173",
  "https://rallytyper.com",
  "https://www.rallytyper.com",
];
if (require.main === module) {
  // local dev only
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}
module.exports = app;

const corsOptions = {
  origin: function (origin, callback) {
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
// app.use(upload.array());
// Connect to MySQL

app.get("/", (req, res) => {
  const apiVersion = "v1";

  const methods = [
    {
      path: `${apipath}/insertblogpost`,
      method: "POST",
      description: "Insert new blog post",
    },
    {
      path: `${apipath}/fetch-blog-posts`,
      method: "GET",
      description: "Fetch all blog posts",
    },
    {
      path: `${apipath}/update-blog-post/:id`,
      method: "PUT",
      description: "Update a blog post by ID",
    },
    {
      path: `${apipath}/fetch-blog-post/:id`,
      method: "GET",
      description: "Fetch a single blog post by ID",
    },
    {
      path: `${apipath}/fetch-blog-post-by-slug/:slug`,
      method: "GET",
      description: "Fetch a single blog post by slug",
    },
    {
      path: `${apipath}/delete-blog-post/:id`,
      method: "delete",
      description: "Delete a single blog post by ID",
    },
  ];
  res.json({ apiVersion, methods });
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Define storage for multer
const storage = multer.diskStorage({
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

// Filter for multer upload
const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "image/jpeg" ||
    file.mimetype === "image/png" ||
    file.mimetype === "image/gif"
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, and GIF files are allowed!"), false);
  }
};

// Initialize multer upload
const uploadMulter = multer({ storage: storage, fileFilter: fileFilter });

// Insert New Blog Post API => `${apipath}/fetch-blog-posts`
app.post(
  `${apipath}/insertblogpost`,
  uploadMulter.single("blogimage"),
  async (req, res) => {
    const {
      title,
      slug,
      canonical_tag,
      meta_title,
      meta_description,
      meta_keywords,
      content,
    } = req.body;
    const upload_date = new Date().toISOString();
    const blogimage = req.file;
    console.log(req.file);

    // Upload image to Cloudinary
    try {
      let imageUrl = "";
      //if(blogimage){
      const result = await cloudinary.uploader.upload(blogimage.path, {
        folder: "blog_images", // Optional: folder to store the image in Cloudinary
      });
      imageUrl = result.secure_url;
      console.log("Image uploaded to Cloudinary:", imageUrl);
      //}

      // Insert data into MySQL
      const sql =
        "INSERT INTO blog_posts (title, slug, canonical_tag, meta_title, meta_description, meta_keywords, content, upload_date, blogimage) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
      const values = [
        title,
        slug,
        canonical_tag,
        meta_title,
        meta_description,
        meta_keywords,
        content,
        upload_date,
        imageUrl,
      ];
      connection.query(sql, values, (error, results, fields) => {
        if (error) {
          console.error("Error executing query:", error);
          res.status(500).send("Internal Server Error");
        } else {
          res.json({ message: "Blog post inserted successfully" });
        }
      });
    } catch (error) {
      console.error("Error uploading image to Cloudinary:", error);
      res.status(500).send("Error uploading image to Cloudinary");
    }
  }
);

// Fetch Blog Posts API
app.get(`${apipath}/fetch-blog-posts`, (req, res) => {
  const sql =
    "SELECT `post_id`, `title`, `slug`, `canonical_tag`, `meta_title`, `meta_description`, `meta_keywords`, `content`,`blogimage`, `upload_date` FROM `blog_posts`";

  connection.query(sql, (error, results, fields) => {
    if (error) {
      console.error("Error executing query:", error);
      res.status(500).send("Internal Server Error");
    } else {
      console.log("Results:", results);
      res.json(results);
    }
  });
});

// Fetch Single Blog Post API
app.get(`${apipath}/fetch-blog-post/:id`, (req, res) => {
  const postId = req.params.id;

  const sql = "SELECT * FROM blog_posts WHERE post_id = ?";
  const values = [postId];

  connection.query(sql, values, (error, results, fields) => {
    if (error) {
      console.error("Error executing query:", error);
      res.status(500).send("Internal Server Error");
    } else {
      if (results.length > 0) {
        res.json(results[0]); // Send the first result (should be the only one)
      } else {
        res.status(404).json({ message: "Blog post not found" });
      }
    }
  });
});

// Fetch Single Blog Post by Slug API
app.get(`${apipath}/fetch-blog-post-by-slug/:slug`, (req, res) => {
  const slug = req.params.slug;

  const sql = "SELECT * FROM blog_posts WHERE slug = ?";
  const values = [slug];

  connection.query(sql, values, (error, results, fields) => {
    if (error) {
      console.error("Error executing query:", error);
      res.status(500).send("Internal Server Error");
    } else {
      if (results.length > 0) {
        res.json(results[0]); // Send the first result (should be the only one)
      } else {
        res.status(404).json({ message: "Blog post not found" });
      }
    }
  });
});

// Update Blog Post
app.put(
  `${apipath}/update-blog-post/:id`,
  uploadMulter.single("blogimage"),
  async (req, res) => {
    const postId = req.params.id;
    const {
      title,
      slug,
      canonical_tag,
      meta_title,
      meta_description,
      meta_keywords,
      content,
    } = req.body;
    const blogimage = req.file;
    console.log(req.files);
    let imageUrl;
    // If a new image is uploaded, update the image in Cloudinary
    if (req.file) {
      try {
        const result = await cloudinary.uploader.upload(blogimage.path, {
          folder: "blog_images", // Optional: folder to store the image in Cloudinary
        });
        imageUrl = result.secure_url;
        console.log(imageUrl);
      } catch (error) {
        console.error("Error uploading image to Cloudinary:", error);
        return res.status(500).send("Error uploading image to Cloudinary");
      }
    }

    let sql;
    let values;
    if (imageUrl) {
      sql =
        "UPDATE blog_posts SET title = ?, slug = ?, canonical_tag = ?, meta_title = ?, meta_description = ?, meta_keywords = ?, content = ?, blogimage = ? WHERE post_id = ?";
      values = [
        title,
        slug,
        canonical_tag,
        meta_title,
        meta_description,
        meta_keywords,
        content,
        imageUrl,
        postId,
      ];
      console.log(values);
    } else {
      sql =
        "UPDATE blog_posts SET title = ?, slug = ?, canonical_tag = ?, meta_title = ?, meta_description = ?, meta_keywords = ?, content = ? WHERE post_id = ?";
      values = [
        title,
        slug,
        canonical_tag,
        meta_title,
        meta_description,
        meta_keywords,
        content,
        postId,
      ];
    }

    connection.query(sql, values, (error, results, fields) => {
      if (error) {
        console.error("Error executing query:", error);
        res.status(500).send("Internal Server Error");
      } else {
        if (results.affectedRows > 0) {
          res.json({ message: "Blog post updated successfully" });
        } else {
          res.status(404).json({ message: "Blog post not found" });
        }
      }
    });
  }
);

// Delete Blog Post API
app.delete(`${apipath}/delete-blog-post/:id`, (req, res) => {
  const postId = req.params.id;
  const sql = "DELETE FROM blog_posts WHERE post_id = ?";
  const values = [postId];
  connection.query(sql, values, (error, results, fields) => {
    if (error) {
      console.error("Error executing query:", error);
      res.status(500).send("Internal Server Error");
    } else {
      if (results.affectedRows > 0) {
        res.json({ message: "Blog post deleted successfully" });
      } else {
        res.status(404).json({ message: "Blog post not found" });
      }
    }
  });
});

// Close the MySQL connection when the app is terminated
process.on("SIGINT", () => {
  connection.end();
  process.exit();
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
