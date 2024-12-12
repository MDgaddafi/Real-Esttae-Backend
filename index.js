const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5001;

// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kr5egii.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const userCollection = client.db("Real_Esttae").collection("users");
    const propertiesCollection = client.db("Real_Esttae").collection("properties");
    const menuCollection = client.db("Real_Esttae").collection("menu");
    const reviewsCollection = client.db("Real_Esttae").collection("reviews");
    const contactCollection = client.db("Real_Esttae").collection("contact");
    const cartCollection = client.db("Real_Esttae").collection("carts");
    const offersCollection = client.db("Real_Esttae").collection("offers");
    const paymentCollection = client.db("Real_Esttae").collection("payments");

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // middlewares
    const verifyToken = (req, res, next) => {
      // console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorize access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorize" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // user related api
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      // insert email if user doesnt exists:
      // you can do this many ways (1. email unique, 2. upsert 3. simple checking)
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // menu related apis
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });
    app.get("/properties", async (req, res) => {
      const result = await propertiesCollection.find().toArray();
      res.send(result);
    });
    
    app.get("/properties/:id", async (req, res) => {
        const id = req.params.id;
        const query = { _id: id };
        const result = await propertiesCollection.findOne(query);
        res.send(result);
    });

    app.post("/menu", verifyToken, verifyAdmin, async (req, res) => {
      const item = req.body;
      const result = await menuCollection.insertOne(item);
      res.send(result);
    });

    app.patch("/menu/:id", async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe,
          image: item.image,
        },
      };
      const result = await menuCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.delete("/menu/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });

    // Backend Route to Save Review
app.post("/reviews", async (req, res) => {
  const { propertyId, buyerEmail, reviewText, rating } = req.body;
  const review = {
    propertyId,
    buyerEmail,
    reviewText,
    rating,
    createdAt: new Date(),
  };

  try {
    const result = await reviewsCollection.insertOne(review);
    res.status(200).send(result);
  } catch (error) {
    console.error("Error saving review:", error);
    res.status(500).send({ message: "Failed to save review" });
  }
});


    // carts collection
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

  app.get("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { menuId: id };
      const result = await cartCollection.findOne(query);
      res.send(result);
  });


  app.get("/offers/:id", async (req, res) => {
    const id = req.params.id;
    const query = { propertyId: id };
    const result = await offersCollection.findOne(query);
    res.send(result);
  });
  app.get("/offers", async (req, res) => {
    const email = req.query.email; // Access the email from query parameters
    const query = { buyerEmail: email };
    try {
      const result = await offersCollection.find(query).toArray(); // Find all offers by buyer email
      res.status(200).send(result);
    } catch (error) {
      console.error("Error fetching reviews: ", error);
      res.status(500).send({ message: "Failed to fetch reviews" });
    }
  });
  app.delete("/offers/:offerId", async (req, res) => {
    const { offerId } = req.params;
    try {
      const result = await offersCollection.deleteOne({ _id: new ObjectId(offerId) });
      if (result.deletedCount === 1) {
        res.status(200).send({ message: "Review deleted successfully" });
      } else {
        res.status(404).send({ message: "Review not found" });
      }
    } catch (error) {
      console.error("Error deleting review:", error);
      res.status(500).send({ message: "Failed to delete review" });
    }
  });
  
  

  app.patch("/properties/buy/:id", async (req, res) => {
    const id = req.params.id;
    const { transactionId } = req.body;
  
    const query = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: {
        status: "bought",
        transactionId: transactionId,
      },
    };
    const result = await propertiesCollection.updateOne(query, updateDoc);
    res.send(result);
  });


  app.patch("/properties/buy/:id", async (req, res) => {
    const propertyId = req.params.id;
    const { transactionId } = req.body;
  
    try {
      const filter = { _id: new ObjectId(propertyId) };
      const updateDoc = {
        $set: {
          status: "bought",
          transactionId: transactionId,
        },
      };
  
      const result = await offersCollection.updateOne(filter, updateDoc);
      res.send(result);
    } catch (error) {
      console.error("Error updating payment status:", error);
      res.status(500).send({ message: "Failed to update property status" });
    }
  });



// Backend Route to Save Contact Form Submission
app.post("/contact", async (req, res) => {
  const { name, email, message } = req.body;
  
  // Validate input fields
  if (!name || !email || !message) {
    return res.status(400).send({ message: "All fields are required." });
  }

  const contact = {
    name,
    email,
    message,
    createdAt: new Date(),
  };

  try {
    // Insert contact form data into the database
    const result = await contactCollection.insertOne(contact);
    res.status(200).send({ message: "Contact form submitted successfully", result });
  } catch (error) {
    console.error("Error saving contact form:", error);
    res.status(500).send({ message: "Failed to submit contact form." });
  }
});

  
  
  
    

  // Backend: API to handle offer submission
app.post("/offers", async (req, res) => {
  try {
    const {
      propertyId,
      title,
      location,
      agent,
      buyerName,
      buyerEmail,
      offeredAmount,
      buyingDate,
      status,
    } = req.body;

    const newOffer = {
      propertyId,
      title,
      location,
      agent,
      buyerName,
      buyerEmail,
      offeredAmount,
      buyingDate,
      status: "pending", // Status is always 'pending' when first submitted
    };

    const result = await offersCollection.insertOne(newOffer);
    res.status(201).send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to submit the offer." });
  }
});


    app.post("/carts", async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    });



    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });


    app.get("/user/properties/:email", async (req, res) => {
      const buyerEmail = req.params.email;
      const query = { buyerEmail }; // Match email from URL
      try {
        const result = await offersCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching properties:", error);
        res.status(500).send({ message: "Failed to fetch properties" });
      }
    });

    // Payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.get("/payments/:email", verifyToken, async (req, res) => {
      const query = { email: req.params.email };
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      // carefully  delete each item from the cart
      console.log("payment info", payment);
      const query = {
        _id: {
          $in: payment.cartIds.map((id) => new ObjectId(id)),
        },
      };

      const deleteResult = await cartCollection.deleteMany(query);
      res.send({ paymentResult, deleteResult });
    });

    // stats or analytics
    app.get("/admin-stats", verifyToken, verifyAdmin, async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      const menuItems = await menuCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();

      // this is not the best way
      // const payments = await paymentCollection.find().toArray();
      // const revenue = payments.reduce((total, payment) => + payment.price, 0);

      const result = await paymentCollection
        .aggregate([
          {
            $group: {
              _id: null,
              totalRevenue: {
                $sum: "$price",
              },
            },
          },
        ])
        .toArray();
      const revenue = result.length > 0 ? result[0].totalRevenue : 0;

      res.send({
        users,
        menuItems,
        orders,
        revenue,
      });
    });

    // using aggregate pipeline
    app.get("/order-stats", verifyToken, verifyAdmin, async (req, res) => {
      const result = await paymentCollection
        .aggregate([
          {
            $unwind: "$menuItemIds",
          },
          {
            $lookup: {
              from: "menu",
              localField: "menuItemIds",
              foreignField: "_id",
              as: "menuItems",
            },
          },
          {
            $unwind: "$menuItems",
          },
          {
            $group: {
              _id: "$menuItems.category",
              quantity: { $sum: 1 },
              revenue: {$sum: '$menuItems.price'}
            }
          },
          {
            $project: {
              _id: 0,
              category: '$_id',
              quantity: '$quantity',
              revenue: '$revenue'
            }
          }
        ])
        .toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("boos is sitting mama");
});

app.listen(port, () => {
  console.log(`Bistro boss is sitting on port ${port}`);
});
